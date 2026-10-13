import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchConversations,
  fetchConversation,
  sendMessage,
  markConversationRead,
} from '../../services/parent/messages';

export const useConversations = (token) =>
  useQuery({
    queryKey: ['parent-conversations', token],
    queryFn: () => fetchConversations(token),
    enabled: Boolean(token),
    select: (response) => response.data,
  });

export const useConversation = (token, threadId) =>
  useQuery({
    queryKey: ['parent-conversation', token, threadId],
    queryFn: () => fetchConversation(token, threadId),
    enabled: Boolean(token && threadId),
    select: (response) => response.data,
  });

export const useSendMessage = (token) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => sendMessage(token, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['parent-conversations', token] });
      if (variables.threadId) {
        queryClient.invalidateQueries({
          queryKey: ['parent-conversation', token, variables.threadId],
        });
      }
    },
  });
};

export const useMarkConversationRead = (token) =>
  useMutation({
    mutationFn: (threadId) => markConversationRead(token, threadId),
  });
