import { useState, useCallback, useEffect } from 'react';
import { useCommunity } from '../context/CommunityContext';
import { listPosts, listComments, ensureClubChat } from '../services/community';

export const useCommunityFeed = () => {
  const { feedPosts, loading, hasMore, fetchFeed } = useCommunity();
  const [skeletonCount] = useState(5);

  return {
    posts: feedPosts,
    loading,
    hasMore,
    loadMore: fetchFeed,
    skeletonCount,
  };
};

export const useClubChat = (clubId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chatPostId, setChatPostId] = useState(null);
  // `filter` is one of questions|files|links|mentions, or null for everything.
  // `query` is the search box. Both are sent to the server, because the chat is
  // paged: filtering only the loaded page would hide matches that exist later.
  const [filter, setFilter] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const { handleAddComment, handleUpdateComment, handleDeleteComment, user } =
    useCommunity();

  useEffect(() => {
    if (!clubId || !user?.role) return;
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      try {
        // One server call, not "list the club's posts, then create if absent".
        // The client-side version was a read followed by a write, so two mounts in
        // the same second both saw no thread and both created one -- leaving two
        // Club Chat posts, and the client reading whichever it found first.
        const chatPost = await ensureClubChat(clubId);
        if (cancelled) return;

        const pid = chatPost?._id || chatPost?.data?._id;
        setChatPostId(pid);

        if (pid) {
          const cRes = await listComments(pid, {
            page: 1,
            perPage: 30,
            ...(filter ? { filter } : {}),
            ...(query.trim() ? { q: query.trim() } : {}),
          });
          const cPayload = cRes.data || {};
          const comments = Array.isArray(cPayload.data)
            ? cPayload.data
            : (Array.isArray(cPayload) ? cPayload : []);
          const meta = cPayload.meta || {};
          setMessages(comments.reverse());
          setPage(meta.page || 1);
          setHasMore((meta.page || 1) < (meta.totalPages || 1));
        }
      } catch (e) {
        console.error('Failed to init chat:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [clubId, user?.role, filter, query]);

  const sendMessage = useCallback(async (body, extra = {}) => {
    // A message can be text, a file, or a forwarded quote ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â `body` alone is no
    // longer the whole payload, so it is no longer the only thing that makes a
    // send valid.
    const hasBody = Boolean(body && body.trim());
    const hasMedia = Boolean(extra.media && extra.media.length);
    if (!chatPostId || (!hasBody && !hasMedia && !extra.forwardedFrom)) return;
    setLoading(true);
    try {
      const comment = await handleAddComment(chatPostId, hasBody ? body : null, null, extra);
      const newMsg = comment?.data || comment;
      if (newMsg) {
        setMessages((prev) => [...prev, newMsg]);
      }
      return newMsg;
    } catch (e) {
      console.error('Failed to send message:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [chatPostId, handleAddComment]);

  const editMessage = useCallback(async (commentId, body) => {
    if (!commentId || !body?.trim()) return;
    setLoading(true);
    try {
      const updated = await handleUpdateComment(commentId, body);
      const next = updated?.data || updated;
      if (next) {
        setMessages((prev) => prev.map((m) => (m._id === commentId ? { ...m, ...next } : m)));
      }
      return next;
    } catch (e) {
      console.error('Failed to edit message:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [handleUpdateComment]);

  const deleteMessage = useCallback(async (commentId) => {
    if (!chatPostId || !commentId) return;
    setLoading(true);
    try {
      await handleDeleteComment(chatPostId, commentId);
      // Dropped locally rather than refetched: the thread is small and the refetch
      // would reorder nothing, but it would also throw away the scroll position of
      // a conversation someone is reading.
      setMessages((prev) => prev.filter((m) => m._id !== commentId));
    } catch (e) {
      console.error('Failed to delete message:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [chatPostId, handleDeleteComment]);

  return {
    messages,
    loading,
    sendMessage,
    editMessage,
    deleteMessage,
    setMessages,
    filter,
    setFilter,
    query,
    setQuery,
  };
};

export const useStudyRoom = () => {
  const [activeRoom, setActiveRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isHost, setIsHost] = useState(false);

  const createRoom = useCallback((roomData) => {
    setActiveRoom(roomData);
    setIsHost(true);
    setParticipants([{ id: 'me', name: 'You', role: 'host' }]);
  }, []);

  const joinRoom = useCallback((roomData) => {
    setActiveRoom(roomData);
    setIsHost(false);
  }, []);

  const leaveRoom = useCallback(() => {
    setActiveRoom(null);
    setParticipants([]);
    setIsHost(false);
  }, []);

  return {
    activeRoom,
    participants,
    isHost,
    createRoom,
    joinRoom,
    leaveRoom,
  };
};
