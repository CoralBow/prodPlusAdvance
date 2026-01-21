import fs from "fs";
import admin from "firebase-admin";

const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf8"),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function runReminderSimulation() {
  console.log("リマインダーダイジェストのシミュレーションを開始します…");

  const now = new Date();
  const nowStr = now.toISOString().split("T")[0];

  try {
    // 1. 期限切れタスクをすべて取得
    const overdueSnap = await db
      .collection("tasks")
      .where("done", "==", false)
      .where("dueDate", "<", nowStr)
      .get();

    const noDueSnap = await db
      .collection("tasks")
      .where("done", "==", false)
      .where("dueDate", "==", null)
      .get();

    // 修正 1: ドキュメントを正しく1つの配列にまとめる
    const allDocs = [...overdueSnap.docs, ...noDueSnap.docs];

    if (allDocs.length === 0) {
      console.log("期限切れ、または期限未設定のタスクはありません。");
      return;
    }

    // 2. userId ごとにタスクをグループ化
    const userGroups = {};

    allDocs.forEach((docSnap) => {
      const task = docSnap.data();
      const userId = task.userId;

      // リマインダー送信が「対象かどうか」を判定するロジック（60時間ルール）
      const lastSent = task.lastReminderSentAt?.toDate
        ? task.lastReminderSentAt.toDate()
        : new Date(0);
      const hoursSinceLast =
        (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLast >= 60) {
        if (!userGroups[userId])
          userGroups[userId] = { taskDetails: [], refs: [] };

        // 修正 2: HTMLリストで日付を使えるよう、オブジェクトとして保存
        userGroups[userId].taskDetails.push({
          title: task.title,
          dueDate: task.dueDate || "なし",
        });
        userGroups[userId].refs.push(docSnap.ref);
      }
    });

    // 3. グループを処理してバッチを構築
    const batch = db.batch();
    let emailCount = 0;

    for (const userId in userGroups) {
      const userSnap = await db.collection("users").doc(userId).get();
      if (!userSnap.exists) continue;

      const userEmail = userSnap.data().email;
      const taskList = userGroups[userId].taskDetails;

      // タスクリストを含むメールドキュメントを1通作成
      const mailRef = db.collection("mail").doc();
      batch.set(mailRef, {
        to: userEmail,
        message: {
          subject: `要対応: 未完了タスクが ${taskList.length} 件あります`,
          text: `期限切れのタスクがあります: ${taskList
            .map((t) => `- ${t.title}（〆 ${t.dueDate}）`)
            .join(", ")}`,
          html: `
            <p>こんにちは。</p>
            <p>以下のタスクが未対応です：</p>
            <ul>
              ${taskList
                .map((t) => `<li>${t.title}（〆 ${t.dueDate}）</li>`)
                .join("")}
            </ul>
          `,
        },
      });

      // このグループ内のすべてのタスクを更新し、60時間再処理されないようにする
      userGroups[userId].refs.forEach((ref) => {
        batch.update(ref, {
          lastReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      emailCount++;
    }

    if (emailCount > 0) {
      await batch.commit();
      console.log(
        `✅ ${emailCount} 件のダイジェストメールを正常にキューへ追加しました。`,
      );
    } else {
      console.log("本日はすでに全ユーザーに通知済みです。");
    }
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

runReminderSimulation();
