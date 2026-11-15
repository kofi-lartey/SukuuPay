import { useState, useCallback, useEffect } from 'react';
import { useCommunity } from '../context/CommunityContext';
import { listComments, ensureClubChat } from '../services/community';

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
  // `query` is the search box. Both go to the server, because the chat is paged:
  // filtering only the loaded page would hide matches that exist later.
  const [filter, setFilter] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const { handleAddComment, handleUpdateComment, handleDeleteComment, user } = useCommunity();

  /*
   * One page of the chat with the current filter applied.
   *
   * Shared by the first load, by a filter change, and by the realtime refresh, so
   * all three read the same data the same way. The API returns newest-first and the
   * chat reads oldest-first.
   */
  const fetchPage = useCallback(
    async (targetPostId, targetPage = 1) => {
      if (!targetPostId) return null;

      const res = await listComments(targetPostId, {
        page: targetPage,
        perPage: 30,
        ...(filter ? { filter } : {}),
        ...(query.trim() ? { q: query.trim() } : {}),
      });

      const payload = res.data || {};
      const list = Array.isArray(payload.data)
        ? payload.data
        : (Array.isArray(payload) ? payload : []);
      const meta = payload.meta || {};

      const ordered = [...list].reverse();
      setMessages(ordered);
      setPage(meta.page || targetPage);
      setHasMore((meta.page || targetPage) < (meta.totalPages || 1));

      return ordered;
    },
    [filter, query]
  );

  // First load, and a reload whenever the club, filter or search changes.
  useEffect(() => {
    if (!clubId || !user?.role) return undefined;
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      try {
        // One server call, not "list the club's posts, then create if absent".
        const chatPost = await ensureClubChat(clubId);
        if (cancelled) return;

        const pid = chatPost?._id || chatPost?.data?._id;
        setChatPostId(pid);
        if (pid) await fetchPage(pid, 1);
      } catch (e) {
        console.error('Failed to init chat:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
    // `fetchPage` changes with the filter, so listing it would refetch twice.
  }, [clubId, user?.role, filter, query]);

  const sendMessage = useCallback(
    async (body, extra = {}) => {
      // A message can be text, a file, or a forwarded quote - `body` alone is no
      // longer the whole payload, so it is no longer the only thing that makes a
      // send valid.
      const hasBody = Boolean(body && body.trim());
      const hasMedia = Boolean(extra.media && extra.media.length);
      if (!chatPostId || (!hasBody && !hasMedia && !extra.forwardedFrom)) return;

      setLoading(true);
      try {
        const comment = await handleAddComment(chatPostId, hasBody ? body : null, null, extra);
        const newMsg = comment?.data || comment;
        if (newMsg) setMessages((prev) => [...prev, newMsg]);
        return newMsg;
      } catch (e) {
        console.error('Failed to send message:', e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [chatPostId, handleAddComment]
  );

  const editMessage = useCallback(
    async (commentId, body) => {
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
    },
    [handleUpdateComment]
  );

  const deleteMessage = useCallback(
    async (commentId) => {
      if (!chatPostId || !commentId) return;
      setLoading(true);
      try {
        await handleDeleteComment(chatPostId, commentId);
        setMessages((prev) => prev.filter((m) => m._id !== commentId));
      } catch (e) {
        console.error('Failed to delete message:', e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [chatPostId, handleDeleteComment]
  );

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
    chatPostId,
    page,
    hasMore,
    /** Re-read page one, for when a socket says something changed. */
    refresh: () => fetchPage(chatPostId, 1),
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
