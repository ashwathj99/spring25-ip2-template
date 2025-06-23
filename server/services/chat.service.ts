import ChatModel from '../models/chat.model';
import MessageModel from '../models/messages.model';
import UserModel from '../models/users.model';
import { Chat, ChatResponse, CreateChatPayload } from '../types/chat';
import { Message, MessageResponse } from '../types/message';

/**
 * Creates and saves a new chat document in the database, saving messages dynamically.
 *
 * @param chat - The chat object to be saved, including full message objects.
 * @returns {Promise<ChatResponse>} - Resolves with the saved chat or an error message.
 */
export const saveChat = async (chatPayload: CreateChatPayload): Promise<ChatResponse> => {
  try {
    const { messages, participants } = chatPayload;
    const messageIds: string[] = [];

    for(const participantId of participants) {
      const user = await UserModel.findById(participantId);
      if (!user) {
        return { error: `User not found: ${participantId}` };
      }
    }

    for (const message of messages) {
      const messageInDB = {
        ...message,
        msgDateTime: message.msgDateTime || new Date()
      };
      const createdMessage = await MessageModel.create(messageInDB);
      messageIds.push(createdMessage._id.toString());
    }


    const chatData = {
      participants,
      messages: messageIds
    };

    const savedChat = await ChatModel.create(chatData);

    return savedChat.toObject();
  } catch(exception) {
    console.error('saveChat Error saving chat: ', exception);
    return ({ error: 'Failed to save chat' });
  }
};

/**
 * Creates and saves a new message document in the database.
 * @param messageData - The message data to be created.
 * @returns {Promise<MessageResponse>} - Resolves with the created message or an error message.
 */
export const createMessage = async (messageData: Message): Promise<MessageResponse> => {
  try {
    const savedMessage = await MessageModel.create(messageData);
    return savedMessage.toObject();
  } catch (exception) {
    console.error('createMessage Failed to create message: ', exception);
    return ({ error: 'Failed create message' });
  }
};

/**
 * Adds a message ID to an existing chat.
 * @param chatId - The ID of the chat to update.
 * @param messageId - The ID of the message to add to the chat.
 * @returns {Promise<ChatResponse>} - Resolves with the updated chat object or an error message.
 */
export const addMessageToChat = async (chatId: string, messageId: string): Promise<ChatResponse> => {
  try {
    const updatedChat = await ChatModel.findByIdAndUpdate(
      chatId,
      { $push: { messages: messageId } },
      { new: true }
    );

    if (!updatedChat) {
      return { error: 'Chat not found'};
    }

    return updatedChat.toObject();
  } catch (exception) {
    console.error('addMessageToChat Failed to add message to chat: ', exception);
    return ({ error: 'Failed to add message to chat' });
  }
};

/**
 * Retrieves a chat document by its ID.
 * @param chatId - The ID of the chat to retrieve.
 * @returns {Promise<ChatResponse>} - Resolves with the found chat object or an error message.
 */
export const getChat = async (chatId: string): Promise<ChatResponse> => {
  try {
    const chat = await ChatModel.findById(chatId);
    
    if (!chat) {
      return { error: 'Chat not found'};
    }

    return chat.toObject();
  } catch (exception) {
    console.error('getChat Failed to get chat: ', exception);
    return ({ error: 'Failed to get chat' });
  }
};

/**
 * Retrieves chats that include all the provided participants.
 * @param p An array of participant usernames to match in the chat's participants.
 * @returns {Promise<Chat[]>} A promise that resolves to an array of chats where the participants match.
 * If no chats are found or an error occurs, the promise resolves to an empty array.
 */
export const getChatsByParticipants = async (p: string[]): Promise<Chat[]> => {
  try {
    const chats = await ChatModel.find({ participants: { $all: p }});
    
    if (!chats) {
      return [];
    }

    return chats.map(chat => chat.toObject());
  } catch (exception) {
    console.error('getChatsByParticipants Failed to get chats by participants: ', exception);
    return [];
  }
};

/**
 * Adds a participant to an existing chat.
 *
 * @param chatId - The ID of the chat to update.
 * @param userId - The ID of the user to add to the chat.
 * @returns {Promise<ChatResponse>} - Resolves with the updated chat object or an error message.
 */
export const addParticipantToChat = async (chatId: string, userId: string): Promise<ChatResponse> => {
  try {
    const user = await UserModel.findById(userId);
    if(!user) {
      return { error: `User not found: ${userId}` };
    }

    const updatedChat = await ChatModel.findByIdAndUpdate(
      chatId,
      { $addToSet: { participants: userId } },
      { new: true }
    );
    
    if (!updatedChat) {
      return { error: 'Failed to add participant to chat' };
    }

    return updatedChat.toObject();
  } catch (exception) {
    console.error('addParticipantToChat Failed to add participant to chat: ', exception);
    return { error: 'Failed to add participant to chat' };
  }
};
