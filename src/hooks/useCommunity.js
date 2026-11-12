import { useState, useCallback, useEffect } from 'react';
import { useCommunity } from '../context/CommunityContext';

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
  const { handleAddComment, handleNewPost, user } = useCommunity();

  useEffect(() => {
    if (!clubId || !user?.role) return;
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      try {
        const svc = await import('../services/community');
        const res = await svc.listPosts({ clubId, perPage: 50 });
        const payload = res.data || {};
        const posts = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);
        let chatPost = posts.find(p => p.postType === 'discussion' && p.title === 'Club Chat');
        if (!chatPost) {
          const created = await handleNewPost({ postType: 'discussion', title: 'Club Chat', body: 'Chat thread', clubId, tags: ['chat'] });
          chatPost = created?.data || created;
        }
        if (cancelled) return;
        const pid = chatPost?._id || chatPost?.data?._id;
        setChatPostId(pid);
        if (pid) {
          const cRes = await svc.listComments(pid, { perPage: 50 });
          const cPayload = cRes.data || {};
          const comments = Array.isArray(cPayload.data) ? cPayload.data : (Array.isArray(cPayload) ? cPayload : []);
          setMessages(comments.reverse());
        }
      } catch (e) {
        console.error('Failed to init chat:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [clubId, handleNewPost, user?.role]);

  const sendMessage = useCallback(async (body) => {
    if (!chatPostId || !body.trim()) return;
    setLoading(true);
    try {
      const comment = await handleAddComment(chatPostId, body);
      const newMsg = comment?.data || comment;
      if (newMsg) {
        setMessages((prev) => [...prev, newMsg]);
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setLoading(false);
    }
  }, [chatPostId, handleAddComment]);

  return { messages, loading, sendMessage, setMessages };
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