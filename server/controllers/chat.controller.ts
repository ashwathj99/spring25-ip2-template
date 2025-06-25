import express, { Response } from 'express';
import {
  saveChat,
  createMessage,
  addMessageToChat,
  getChat,
  addParticipantToChat,
  getChatsByParticipants,
} from '../services/chat.service';
import { populateDocument } from '../utils/database.util';
import {
  CreateChatRequest,
  AddMessageRequestToChat,
  AddParticipantRequest,
  ChatIdRequest,
  GetChatByParticipantsRequest,
} from '../types/chat';
import { FakeSOSocket } from '../types/socket';
import { Message } from '../types/types';

/*
 * This controller handles chat-related routes.
 * @param socket The socket instance to emit events.
 * @returns {express.Router} The router object containing the chat routes.
 * @throws {Error} Throws an error if the chat creation fails.
 */
const chatController = (socket: FakeSOSocket) => {
  const router = express.Router();

  /**
   * Validates that the request body contains all required fields for a chat.
   * @param req The incoming request containing chat data.
   * @returns `true` if the body contains valid chat fields; otherwise, `false`.
   */
  const isCreateChatRequestValid = (req: CreateChatRequest): boolean => {
    const { participants, messages } = req.body;

    if (!participants || !Array.isArray(participants) || participants.length == 0 || !Array.isArray(messages)) {
      return false;
    }
    return true;
  };

  /**
   * Validates that the request body contains all required fields for a message.
   * @param req The incoming request containing message data.
   * @returns `true` if the body contains valid message fields; otherwise, `false`.
   */
  const isAddMessageRequestValid = (req: AddMessageRequestToChat): boolean => {
    const { msg, msgFrom } = req.body;
    const { chatId } = req.params;

    if (!msg || !msgFrom || !chatId) {
      return false;
    }
    return true;
  }

  /**
   * Validates that the request body contains all required fields for a participant.
   * @param req The incoming request containing participant data.
   * @returns `true` if the body contains valid participant fields; otherwise, `false`.
   */
  const isAddParticipantRequestValid = (req: AddParticipantRequest): boolean => {
    const { userId } = req.body;
    const { chatId } = req.params;

    if (!userId || !chatId) {
      return false;
    }
    return true;
  }

  /**
   * Creates a new chat with the given participants (and optional initial messages).
   * @param req The request object containing the chat data.
   * @param res The response object to send the result.
   * @returns {Promise<void>} A promise that resolves when the chat is created.
   * @throws {Error} Throws an error if the chat creation fails.
   */
  const createChatRoute = async (req: CreateChatRequest, res: Response): Promise<void> => {
    // TODO: Task 3 - Implement the createChatRoute function
    // Emit a `chatUpdate` event to share the creation of a new chat
    if (!isCreateChatRequestValid(req)) {
      res.status(400).send('Invalid body');
      return;
    };

    try {
      const result = await saveChat(req.body);
      if ('error' in result) {
        throw new Error(result.error);
      }

      const enrichedResult = await populateDocument(result._id?.toString(), 'chat');
      if ('error' in enrichedResult) {
        throw new Error(enrichedResult.error);
      }
      
      result.participants.forEach( (participant) => {
        socket.to(participant).emit('chatUpdate', {
        chat: enrichedResult,
        type: 'created',
        });
      });
      res.status(200).send(enrichedResult);
    } catch (exception) {
      console.error('createChatRoute Error when creating chat: ', exception);
      res.status(500).send(`Error when creating chat: ${exception}`);
    }
  };

  /**
   * Adds a new message to an existing chat.
   * @param req The request object containing the message data.
   * @param res The response object to send the result.
   * @returns {Promise<void>} A promise that resolves when the message is added.
   * @throws {Error} Throws an error if the message addition fails.
   */
  const addMessageToChatRoute = async (
    req: AddMessageRequestToChat,
    res: Response,
  ): Promise<void> => {
    // TODO: Task 3 - Implement the addMessageToChatRoute function
    // Emit a `chatUpdate` event to share the updated chat, specifically to
    // the chat room where the message was added (hint: look into socket rooms)
    // NOTE: Make sure to define the message type to be a direct message when creating it.
    if (!isAddMessageRequestValid(req)) {
      res.status(400).send('Invalid body');
      return;
    }

    const message: Message = {
      ...req.body,
      type: 'direct',
      msgDateTime: req.body.msgDateTime || new Date()
    };

    const { chatId } = req.params;

    try {
      const messageResult = await createMessage(message);
      if('error' in messageResult) {
        throw new Error(messageResult.error);
      }

      if (!messageResult._id) {
        throw new Error('Failed to add message to chat');
      }

      const chatResult = await addMessageToChat(
        chatId,
        messageResult._id.toString()
      )

      if ('error' in chatResult) {
        throw new Error(chatResult.error);
      }

      if (!chatResult._id) {
        throw new Error('Invalid chat found');
      }

      const enrichedChat = await populateDocument(
        chatResult._id.toString(),
        'chat'
      );

      socket.to(chatId).emit('chatUpdate', {
        chat: enrichedChat,
        type: 'newMessage',
      });
      res.status(200).send(enrichedChat);
    } catch(exception) {
      console.error('addMessageToChatRoute Error when adding message to chat: ', exception);
      res.status(500).send(`Error when adding message to chat: ${exception}`);
    }
  };

  /**
   * Retrieves a chat by its ID, optionally populating participants and messages.
   * @param req The request object containing the chat ID.
   * @param res The response object to send the result.
   * @returns {Promise<void>} A promise that resolves when the chat is retrieved.
   * @throws {Error} Throws an error if the chat retrieval fails.
   */
  const getChatRoute = async (req: ChatIdRequest, res: Response): Promise<void> => {
    // TODO: Task 3 - Implement the getChatRoute function
    const { chatId } = req.params;

    try {
      const result = await getChat(chatId);
      if ('error' in result) {
        throw new Error(`Failed to get chat: ${result.error}`);
      }

      const enrichedResult = await populateDocument(
        result._id?.toString(),
        'chat'
      );
      if ('error' in enrichedResult) {
        throw new Error(enrichedResult.error);
      }

      res.status(200).send(enrichedResult);
    } catch (exception) {
      console.error('getChatRoute Failed to get chat', exception);
      res.status(500).send('Failed to get chat by chatId');
    }
  };

  /**
   * Retrieves chats for a user based on their username.
   * @param req The request object containing the username parameter in `req.params`.
   * @param res The response object to send the result, either the populated chats or an error message.
   * @returns {Promise<void>} A promise that resolves when the chats are successfully retrieved and populated.
   */
  const getChatsByUserRoute = async (
    req: GetChatByParticipantsRequest,
    res: Response,
  ): Promise<void> => {
    // TODO: Task 3 - Implement the getChatsByUserRoute function
    const { username } = req.params;
    if (!username) {
      res.status(400).send('Invalid body');
      return;
    }

    try {
      const chatResult = await getChatsByParticipants([username]);

      const enrichedChats = [];
      for (const chat of chatResult) {
        if (!chat._id) {
          throw new Error('Invalid chat found');
        }
        const enrichedChat = await populateDocument(chat._id.toString(), 'chat');
        if ('error' in enrichedChat) {
          throw new Error('Failed populating chats');
        }

        enrichedChats.push(enrichedChat);
      }

      res.status(200).send(enrichedChats);
    } catch (exception) {
      console.error('getChatsByUserRoute Failed to get chat by user', exception);
      const errorMessage = (exception instanceof Error) ? exception.message : `${exception}`;
      res.status(500).send(`Error retrieving chat: ${errorMessage}`);
    }
  };

  /**
   * Adds a participant to an existing chat.
   * @param req The request object containing the participant data.
   * @param res The response object to send the result.
   * @returns {Promise<void>} A promise that resolves when the participant is added.
   * @throws {Error} Throws an error if the participant addition fails.
   */
  const addParticipantToChatRoute = async (
    req: AddParticipantRequest,
    res: Response,
  ): Promise<void> => {
    // TODO: Task 3 - Implement the addParticipantToChatRoute function
    if (!isAddParticipantRequestValid(req)) {
      res.status(400).send('Invalid body');
      return;
    }

    const { chatId } = req.params;
    const { userId } = req.body;

    try {
      const result = await addParticipantToChat(chatId, userId);
      if ('error' in result) {
        res.status(500).send(`Failed to add participant to chat room ${result.error}`);
        return;
      }
      res.status(200).send(result);
    } catch (exception) {
      console.error('addParticipantToChatRoute Failed to add participant to chat room', exception);
      res.status(500).send(`Failed to add participant to chat room: ${exception}`);
    }
  };

  socket.on('connection', conn => {
    // TODO: Task 3 - Implement the `joinChat` event listener on `conn`
    // The socket room will be defined to have the chat ID as the room name
    // TODO: Task 3 - Implement the `leaveChat` event listener on `conn`
    // You should only leave the chat if the chat ID is provided/defined
    conn.on('joinChat', (chatId: string) => {
      conn.join(chatId);
      console.log('A user has joined the chat room: ', chatId);
    });

    conn.on('leaveChat', (chatId: string | undefined) => {
      if (chatId) {
        conn.leave(chatId);
        console.log('A user has left the chat room: ', chatId);
      }
    });
  });

  // Register the routes
  // TODO: Task 3 - Add appropriate HTTP verbs and endpoints to the router
  router.post('/createChat', createChatRoute);
  router.get('/getChatsByUser/:username', getChatsByUserRoute);
  router.post('/:chatId/addMessage', addMessageToChatRoute);
  router.get('/:chatId', getChatRoute);
  router.post('/:chatId/addParticipant', addParticipantToChatRoute);

  return router;
};

export default chatController;
