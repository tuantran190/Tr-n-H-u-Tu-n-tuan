import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || '';
const chatId = process.env.TELEGRAM_CHAT_ID || '';

let bot: TelegramBot | null = null;
if (token) {
    bot = new TelegramBot(token, { polling: false });
}

export const sendTelegramMessage = async (message: string) => {
    if (!bot || !chatId) {
        console.warn('[Telegram Mock] Message:', message);
        return;
    }
    try {
        await bot.sendMessage(chatId, message);
    } catch (error) {
        console.error('Failed to send Telegram message:', error);
    }
};
