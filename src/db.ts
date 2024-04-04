import { SQLite3Connector, DataTypes, Model, Database } from "denodb";
import Config from "./config.ts";


class MessageModel extends Model {
    static table = "messages";
    static timestamps = true;

    static fields = {
        id: { primaryKey: true, autoIncrement: true },
        fromId: DataTypes.INTEGER,
        toId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        topicId: DataTypes.INTEGER,
        ChatId: DataTypes.INTEGER,
    };
}

class BusinessConnectionModel extends Model {
    static table = "business_connections";

    static fields = {
        id: { primaryKey: true, autoIncrement: true },
        ownerId: DataTypes.INTEGER,
        connectionId: DataTypes.STRING,
        logChatId: DataTypes.INTEGER,
    };
}

class PmManagerDB {
    private db: Database;
    private config: Config;
    private connector: SQLite3Connector;
    constructor() {
        this.config = new Config();
        this.connector = new SQLite3Connector({
            filepath: this.config.dbString,
        });

        this.db = new Database(this.connector);
        this.initDatabase();
    }

    private initDatabase() {
        this.db.link([MessageModel, BusinessConnectionModel]);
        this.db.sync({ drop: false });
    }

    async addMessage(fromId: number, toId: number, topicId: number, userId: number, ChatId: number): Promise<void> {
        await MessageModel.create({ fromId, toId, topicId, userId, ChatId });
    }

    async getMessagesByToId(toId: number, chatId: number): Promise<number | null> {
        const message = await MessageModel.where("toId", toId).where("ChatId", chatId).first();
        if (message) {
            return Number(message.fromId);
        }
        return null;
    }

    async getTopicIdByUserId(userId: number, connectionId: string): Promise<number | null> {
        const chatId = await this.getLogChatFromBusinessId(connectionId);
        const message = await MessageModel.where("userId", userId).where("ChatId", chatId).first();
        if (message) {
            return Number(message.topicId);
        }
        return null;
    }

    async getMessagesByFromId(fromId: number, chatId: number): Promise<number | null> {
        const message = await MessageModel.where("fromId", fromId).where("ChatId", chatId).first();
        if (message) {
            return Number(message.toId);
        }
        return null;
    }

    async userIdByTopicId(topicId: number, logchat: number): Promise<number | null> {
        const logchatid = await this.getLogChatId(logchat)
        const message = await MessageModel.where("topicId", topicId).where("ChatId", logchatid).first();
        if (message) {
            return Number(message.userId);
        }
        return null;
    }

    async addBusinessConnection(ownerId: number, connectionId: string): Promise<void> {
        const existingConnection = await BusinessConnectionModel.where("ownerId", ownerId).first();
        if (existingConnection) {
            await BusinessConnectionModel.where("ownerId", ownerId).update({ connectionId });
        } else {
            await BusinessConnectionModel.create({ ownerId, connectionId, logChatId: null });
        }
    }

    async deleteBusinessConnection(connectionId: string): Promise<void> {
        await BusinessConnectionModel.where("connectionId", connectionId).delete();
    }

    async addLogChatToBusinessConnection(ownerId: number, logChatId: number): Promise<void> {
        await BusinessConnectionModel.where("ownerId", ownerId).update({ logChatId });
    }

    async getLogChatFromBusinessId(connectionId: string): Promise<number | null> {
        const connection = await BusinessConnectionModel.where("connectionId", connectionId).first();
        if (connection) {
            return Number(connection.logChatId);
        }
        return null;
    }

    async getLogChatId(logChatId: number): Promise<number | null> {
        const connection = await BusinessConnectionModel.where("logChatId", logChatId).first();
        if (connection) {
            return Number(connection.logChatId);
        }
        return null;
    }

    async getLogInfo(logChatId: number): Promise<[number, string | null]> {
        const connection = await BusinessConnectionModel.where("logChatId", logChatId).first();
        if (connection) {
            return [Number(connection.logChatId), String(connection.connectionId)];
        }
        return [0, null];
    }
    async getLogChatFromOwnerId(ownerId: number): Promise<number | null> {
        const connection = await BusinessConnectionModel.where("ownerId", ownerId).first();
        if (connection) {
            return Number(connection.logChatId);
        }
        return null;
    }

    async getOwnerIdFromBusinessId(connectionId: string): Promise<number | null> {
        const connection = await BusinessConnectionModel.where("connectionId", connectionId).first();
        if (connection) {
            return Number(connection.ownerId);
        }
        return null;
    }

    async checkDatabaseConnection(): Promise<boolean> {
        try {
            return await this.db.ping();
        } catch (error) {
            console.error("Database connection error:", error);
            return false;
        }
    }
}


export default PmManagerDB;
