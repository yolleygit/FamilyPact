export const COURSES = [
    { id: 101, text: "新东方 🏫", score: 20 },
    { id: 102, text: "口才 🗣️", score: 15 },
    { id: 103, text: "练声 🎵", score: 15 }
];

export const categories = [
    {
        id: "A",
        name: "🌅 元气生活",
        items: [
            { id: 18, text: "运动小健将 (30分钟) 🏃", score: 20, type: "exercise", required: true },
            { id: 1, text: "早起小鸟 (8:30前) 🐣", score: 10, type: "check", required: false },
            { id: 2, text: "吃饭快快星人 (🍱 25min)", score: 15, type: "meals", required: false },
            { id: 3, text: "听力满分 (自觉开饭) 👂", score: 10, type: "reminders", required: false },
            { id: 4, text: "文明小标兵 (出口成章) 🤫", score: 10, type: "reminders", required: false },
            { id: 5, text: "小脚丫不着地 (穿拖鞋) 👟", score: 10, type: "reminders", required: false },
            { id: 6, text: "身体直挺挺 (坐姿标杆) 📏", score: 10, type: "reminders", required: false },
            { id: 19, text: "时间守门员 (拒绝拖延) ⏳", score: 10, type: "penalty", required: false },
            { id: 20, text: "专心致志 (勿搞名堂) 🎯", score: 5, type: "penalty", required: false },
        ]
    },
    {
        id: "C",
        name: "📚 学习闯关",
        items: [
            { id: 12, text: "作业通关 (每天 2 页) 📝", score: 10, type: "check", required: true },
            { id: 13, text: "脑力大风暴 (奥数题) 🔢", score: 10, type: "check", required: true },
            { id: 14, text: "语文探险家 📖", score: 20, type: "check", required: false },
            { id: 15, text: "今天我最高光 (总结) 🌟", score: 10, type: "check", required: false },
            { id: 16, text: "书海小航员(阅读) ⛵", score: 10, type: "check", required: false },
            { id: 17, text: "小小程序员 (AI 探索) 💻", score: 20, type: "check", required: false },
        ]
    },
    {
        id: "B",
        name: "🧹 劳动最光荣",
        items: [
            { id: 7, text: "餐桌小助手 (拿/收/抹) 🍽️", score: 15, type: "subtasks", subtasks: ["拿碗筷", "收碗筷", "桌面清理"], required: true },
            { id: 8, text: "全能家务王 (勤劳致富) 🧹", score: 25, type: "bonus_subtasks", subtasks: ["扫地", "倒垃圾", "洗碗", "收衣服", "整理床铺", "整理书桌"], max: 25 },
            { id: 9, text: "惊喜奖励 (主动发现) 🎁", score: 10, type: "check", required: false },
            { id: 10, text: "暖心小广播 (叫爷爷) 📢", score: 5, type: "dots", count: 2, required: false },
        ]
    },
    {
        id: "D",
        name: "👤 我的状态",
        items: []
    }
];

export const RULES = {
    BASE_SCORE: 140,
    STEP_SCORE: 20,
    REWARD_PER_STEP: 30, // minutes
    REMINDER_REDUCTION: 5, // 1 time -> 5, 2 times -> 0, >2 -> -5 each
    EXTRA_EXERCISE_REWARD: 15,
};
