import { useEffect, useState } from 'react';
import { Chat, ChatUpdatePayload, Message, User } from '../types';
import useUserContext from './useUserContext';
import { createChat, getChatById, getChatsByUser, sendMessage } from '../services/chatService';

/**
 * useDirectMessage is a custom hook that provides state and functions for direct messaging between users.
 * It includes a selected user, messages, and a new message state.
 */

const useDirectMessage = () => {
  const { user, socket } = useUserContext();
  const [showCreatePanel, setShowCreatePanel] = useState<boolean>(false);
  const [chatToCreate, setChatToCreate] = useState<string>('');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [newMessage, setNewMessage] = useState('');

  const handleJoinChat = (chatID: string) => {
    // TODO: Task 3 - Emit a 'joinChat' event to the socket with the chat ID function argument.
    socket.emit('joinChat', chatID);
  };

  const handleSendMessage = async () => {
    // TODO: Task 3 - Implement the send message handler function.
    // Whitespace-only messages should not be sent, and the current chat to send this message to
    // should be defined. Use the appropriate service function to make an API call, and update the
    // states accordingly.
    if (!newMessage.trim() || !selectedChat || !selectedChat._id) {
      return;
    }

    try {
      const message = {
        msg: newMessage.trim(),
        msgFrom: user.username,
        msgDateTime: new Date(),
      };

      await sendMessage(message, selectedChat._id);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleChatSelect = async (chatID: string | undefined) => {
    // TODO: Task 3 - Implement the chat selection handler function.
    // If the chat ID is defined, fetch the chat details using the appropriate service function,
    // and update the appropriate state variables. Make sure the client emits a socket event to
    // subscribe to the chat room.
    if (!chatID) {
      setSelectedChat(null);
      return;
    }

    try {
      const chat = await getChatById(chatID);
      setSelectedChat(chat);
      handleJoinChat(chatID);
    } catch (exception) {
      console.error('Error fetching chat.', exception);
    }
  };

  const handleUserSelect = (selectedUser: User) => {
    setChatToCreate(selectedUser.username);
  };

  const handleCreateChat = async () => {
    // TODO: Task 3 - Implement the create chat handler function.
    // If the username to create a chat is defined, use the appropriate service function to create a new chat
    // between the current user and the chosen user. Update the appropriate state variables and emit a socket
    // event to join the chat room. Hide the create panel after creating the chat.
    console.log('Creating chat between:', user.username, 'and', chatToCreate);
    if (!chatToCreate.trim()) {
      console.error('Cannot create a chat with an empty username.');
      return;
    }
    try {
      const participants = [user.username, chatToCreate];
      const newChat = await createChat(participants);
      
      if (newChat) {
        
        setChats((prevChats) => {
          return [...prevChats, newChat]});
        setSelectedChat(newChat);
        handleJoinChat(newChat._id);
        setShowCreatePanel(false);
        setChatToCreate('');
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  useEffect(() => {
    const fetchChats = async () => {
      // TODO: Task 3 - Fetch all the chats with the current user and update the state variable.
      try {
        const userChats = await getChatsByUser(user.username);
        setChats(userChats);
      } catch (error) {
        console.error('Error fetching chats:', error);
      }
    };

    const handleChatUpdate = (chatUpdate: ChatUpdatePayload) => {
      // TODO: Task 3 - Implement the chat update handler function.
      // This function is responsible for updating the state variables based on the
      // socket events received. The function should handle the following cases:
      // - A new chat is created (add the chat to the current list of chats)
      // - A new message is received (update the selected chat with the new message)
      // - Throw an error for an invalid chatUpdate type
      // NOTE: For new messages, the user will only receive the update if they are
      // currently subscribed to the chat room.

      let participants = chatUpdate.chat.participants;
      if (participants.length > 0) {
        participants = participants.flat();
      }
      switch(chatUpdate.type) {
        case 'created':
          if (participants.includes(user.username)) {
            setChats( (prevChats) => {
              const oldChatExists = prevChats.some(chat => chat._id === chatUpdate.chat._id);
              if(!oldChatExists) {
                const retVal=[...prevChats, chatUpdate.chat]
                return retVal;
              }
              return prevChats;
            });
          }
          break;

        case 'newMessage':
          if (selectedChat && selectedChat._id === chatUpdate.chat._id) {
            setSelectedChat(chatUpdate.chat);
          }
          setChats( (prevChats) => prevChats.map(chat => chat._id === chatUpdate.chat._id ? chatUpdate.chat : chat ));
          break;

        default:
          throw new Error(`Invalid chat update type: ${chatUpdate.type}`)
      }
    };

    fetchChats();

    // TODO: Task 3 - Register the 'chatUpdate' event listener
    socket.on('chatUpdate', handleChatUpdate);


    return () => {
      // TODO: Task 3 - Unsubscribe from the socket event
      socket.off('chatUpdate', handleChatUpdate);
      // TODO: Task 3 - Emit a socket event to leave the particular chat room
      // they are currently in when the component unmounts.
      socket.emit('leaveChat', selectedChat?._id);
    };
  }, [user.username, socket, selectedChat?._id]);

  return {
    selectedChat,
    chatToCreate,
    chats,
    newMessage,
    setNewMessage,
    showCreatePanel,
    setShowCreatePanel,
    handleSendMessage,
    handleChatSelect,
    handleUserSelect,
    handleCreateChat,
  };
};

export default useDirectMessage;
