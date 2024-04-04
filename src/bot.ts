import { Composer, Context } from "grammy/mod.ts";
import PmManagerDB from "./db.ts";


const composer = new Composer();
const db = new PmManagerDB();

// Functions
// deno-lint-ignore no-explicit-any
const reply = async (ctx: Context, text: string, reply_markup: any = undefined) =>
	await ctx.reply(text, {
		parse_mode: "HTML",
		link_preview_options: {
			is_disabled: true,
		},
		reply_to_message_id: ctx.message?.message_id,
		reply_markup,
	});


// Start command
composer.command(
	"start",
	async (ctx: Context) =>
		await reply(
			ctx,
			`Hello <b>${ctx.from?.first_name}</b>! I am a personal Pm Chatbot only for business users. You can connect your business account to this bot and receive all your messages in a private chat. To get started, click the button below.`,
			{
				inline_keyboard: [
					[
						{
							text: "How to use?",
							url: "https://t.me/telegram/292",
						},
					],
				],
			},
		),
);



composer.on("business_connection:is_enabled", async (ctx: Context) => {
	if (ctx.businessConnection?.is_enabled) {
		try {
			await ctx.api.sendMessage(ctx.businessConnection.user_chat_id, "Business connection is enabled you can now send messages to the business", {
				reply_markup: {
					keyboard: [
						[
							{
								text: "Add Log Chat",

								request_chat: {
									request_id: ctx.businessConnection.date,
									chat_is_forum: true,
									chat_is_channel: false,
									bot_is_member: true,
									user_administrator_rights: {
										can_restrict_members: true,
										can_delete_messages: false,
										can_invite_users: false,
										can_pin_messages: true,
										is_anonymous: false,
										can_change_info: false,
										can_manage_topics: true,
										can_manage_chat: false,
										can_promote_members: false,
										can_delete_stories: false,
										can_edit_stories: false,
										can_manage_video_chats: false,
										can_post_stories: false,
									},
									bot_administrator_rights: {
										can_restrict_members: true,
										can_delete_messages: false,
										can_invite_users: false,
										can_pin_messages: true,
										is_anonymous: false,
										can_change_info: false,
										can_manage_topics: true,
										can_manage_chat: false,
										can_promote_members: false,
										can_delete_stories: false,
										can_edit_stories: false,
										can_manage_video_chats: false,
										can_post_stories: false,
									},
								},

							},
						],
					],
					resize_keyboard: true,
				},
			});
			return await db.addBusinessConnection(ctx.businessConnection.user_chat_id, ctx.businessConnection.id);
		} catch (error) {
			return console.log(`Error in business_connection:is_enabled for ${ctx.businessConnection.user_chat_id}: ${error}`);
		}
	} else if (!ctx.businessConnection?.is_enabled) {
		await db.deleteBusinessConnection(String(ctx.businessConnectionId));
		return await ctx.api.sendMessage(ctx.businessConnection?.user_chat_id!, "Business connection is disabled");
	}
});


composer.on("message:chat_shared", async (ctx: Context) => {
	const logchat = await db.getLogChatFromOwnerId(ctx.message?.from?.id!);
	if (logchat) {
		await reply(ctx, "You already have a log chat connected to your account currently getting disconnected");
	}
	const oldChat = await db.getLogChatId(ctx.message?.chat_shared?.chat_id!);
	if (oldChat) {
		return await reply(ctx, "This chat is already connected to an account");
	}
	await db.addLogChatToBusinessConnection(ctx.message?.from?.id!, ctx.message?.chat_shared?.chat_id!);
	await ctx.api.sendMessage(ctx.message?.chat_shared?.chat_id!, "This chat is now connected to your account and will be used to receive all your private messages");
	await reply(ctx, "Log chat added successfully", {
		remove_keyboard: true,
	});
});


composer.on("business_message", async (ctx: Context) => {
	const ownerId = await db.getOwnerIdFromBusinessId(String(ctx.businessMessage?.business_connection_id));
	if (ownerId === ctx.businessMessage?.from?.id || !ownerId) return;
	const logchat = await db.getLogChatFromBusinessId(String(ctx.businessMessage?.business_connection_id));
	if (logchat) {
		const topicid = await db.getTopicIdByUserId(ctx.businessMessage?.from?.id!, String(ctx.businessMessage?.business_connection_id));
		if (!topicid) {
			const firstText = await ctx.api.createForumTopic(logchat, `${ctx.businessMessage?.from?.first_name} ${ctx.businessMessage?.from?.last_name || ''}`);
			await sendIntro(ctx, logchat, firstText.message_thread_id);
			return await sendMessage(ctx, logchat, firstText.message_thread_id);
		} else {
			if (ctx.businessMessage?.reply_to_message?.message_id) {
				const replytoId = await db.getMessagesByToId(ctx.businessMessage?.reply_to_message.message_id!, ctx?.businessMessage?.from?.id!);
				return await sendMessage(ctx, logchat, topicid, replytoId);
			}
			return await sendMessage(ctx, logchat, topicid);
		}
	} else {
		const ownerId = await db.getOwnerIdFromBusinessId(String(ctx.businessMessage?.business_connection_id));
		return await ctx.api.sendMessage(ownerId!, "You don't have a log chat connected to your account");
	}
});


composer.on("message", async (ctx: Context) => {
	const [logchat, businessId] = await db.getLogInfo(ctx.message?.chat?.id!);
	if (!ctx.message?.is_topic_message || !logchat) return;
	const userId = await db.userIdByTopicId(ctx.message?.message_thread_id!, logchat);
	if (!userId) {
		return await reply(ctx, "User Chat not found");
	} else {
		if (ctx.message?.reply_to_message?.message_id && ctx.message?.reply_to_message?.message_id !== ctx.message?.reply_to_message?.message_thread_id) {
			let replytoId = await db.getMessagesByFromId(ctx.message?.reply_to_message.message_id!, logchat);
			if (ctx.message?.reply_to_message?.from?.id === ctx.me.id) {
				replytoId = await db.getMessagesByToId(ctx.message?.reply_to_message.message_id!, logchat);
			}
			return await sendMessage(ctx, userId, null, replytoId, businessId);
		}
		return await sendMessage(ctx, userId, null, null, businessId);
	}
});


async function sendIntro(ctx: Context, logchat: number, topicid: number): Promise<void> {
	const userinfo = await ctx.getChat()
	if (userinfo && userinfo.type === 'private') {
		const { first_name: firstName, last_name: lastName, username, birthdate, bio, id } = userinfo;
		const photo = (await ctx.api.getUserProfilePhotos(id, { limit: 1 })).photos;
		const isPremium = ctx.message?.from?.is_premium;
		let introMessage = '<b>✘  Usᴇʀ Iɴғᴏ ✘</b>\n\n';
		if (firstName) introMessage += `<b>✘  Fɪʀsᴛ Nᴀᴍᴇ:</b> <code>${firstName}</code>\n`;
		if (lastName) introMessage += `<b>✘ Lᴀsᴛ Nᴀᴍᴇ:</b> <code>${lastName}</code>\n`;
		if (username) introMessage += `<b>✘ Usᴇʀɴᴀᴍᴇ:</b> <code>${username}</code>\n`;
		if (id) introMessage += `<b>✘ Usᴇʀ ID:</b> <code>${id}</code>\n`;
		if (birthdate) introMessage += `<b>✘ Bɪʀᴛʜᴅᴀᴛᴇ:</b> <code>${birthdate}</code>\n`;
		introMessage += `<b>✘ Is Pʀᴇᴍɪᴜᴍ:</b> <code>${isPremium ? 'Yes' : 'No'}</code>\n`;
		if (bio) introMessage += `\n\n<b>✘ Bɪᴏ:</b> <code>${bio}</code>`;
		if (photo.length > 0) {
			await ctx.api.sendPhoto(logchat, photo[0][0].file_id, { caption: introMessage, message_thread_id: topicid, parse_mode: 'HTML' });
			return;
		}
		await ctx.api.sendMessage(logchat, introMessage, { message_thread_id: topicid, parse_mode: 'HTML' });
		return;
	}
	await ctx.api.sendMessage(logchat, 'User is not a valid user', { message_thread_id: topicid });
	return
}



async function sendMessage(ctx: Context, chatId: number, topicid: number | null = null, replytoId: number | null = null, businessId: string | null = null): Promise<void> {
	const message = ctx?.businessMessage ? ctx.businessMessage : ctx.message;
	const opts: { message_thread_id: number | undefined, reply_to_message_id?: number, business_connection_id?: string } = { message_thread_id: topicid ? topicid : undefined };
	if (!message) return;
	if (replytoId) {
		opts.reply_to_message_id = replytoId;
	}
	if (businessId) {
		opts.business_connection_id = businessId;
	}
	let sent;
	if (message.text) {
		sent = await ctx.api.sendMessage(chatId, message.text, opts);
	} else if (message.audio) {
		sent = await ctx.api.sendAudio(chatId, message.audio.file_id, opts);
	} else if (message.document) {
		sent = await ctx.api.sendDocument(chatId, message.document.file_id, opts);
	} else if (message.photo) {
		sent = await ctx.api.sendPhoto(chatId, message.photo[0].file_id, opts);
	} else if (message.sticker) {
		sent = await ctx.api.sendSticker(chatId, message.sticker.file_id, opts);
	} else if (message.video) {
		sent = await ctx.api.sendVideo(chatId, message.video.file_id, opts);
	} else if (message.voice) {
		sent = await ctx.api.sendVoice(chatId, message.voice.file_id, opts);
	} else if (message.animation) {
		sent = await ctx.api.sendAnimation(chatId, message.animation.file_id, opts);
	} else if (message.video_note) {
		sent = await ctx.api.sendVideoNote(chatId, message.video_note.file_id, opts);
	} else if (message.contact) {
		sent = await ctx.api.sendContact(chatId, message.contact.phone_number, message.contact.first_name, opts);
	} else if (message.location) {
		sent = await ctx.api.sendLocation(chatId, message.location.latitude, message.location.longitude, opts);
	} else if (message.venue) {
		sent = await ctx.api.sendVenue(chatId, message.venue.location.latitude, message.venue.location.longitude, message.venue.title, message.venue.address, opts);
	} else if (message.dice) {
		sent = await ctx.api.sendDice(chatId, message.dice.emoji, opts);
	} else if (message.game) {
		sent = await ctx.api.sendGame(chatId, message.game.title, opts);
	}
	await db.addMessage(message.message_id!, sent?.message_id!, topicid!, message.from?.id!, chatId);
	return
}


export default composer;
