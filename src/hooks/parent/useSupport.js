import { useMutation } from '@tanstack/react-query';
import { sendSupportMessage } from '../../services/parent/support';

export const useSendSupportMessage = (token) =>
  useMutation({
    mutationFn: (payload) => sendSupportMessage(token, payload),
  });
