import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { initializeSocket, joinSchoolCommunity } from '../utils/socket';
import {
  listPosts,
  createPost,
  createPoll,
  listComments,
  createComment,
  addReaction,
  getReactionCount,
  listClubs,
  createClub,
  toggleClubMembership,
  deletePost,
  bookmarkPost,
  createEvent,
  listEvents,
  rsvpEvent,
  deleteEvent,
} from '../services/community';

const CommunityContext = createContext(null);

export const useCommunity = () => {
  const context = useContext(CommunityContext);
  if (!context) {
    throw new Error('useCommunity must be used within a CommunityProvider');
  }
  return context;
};

export const CommunityProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [feedPosts, setFeedPosts] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeSpace, setActiveSpace] = useState('feed'); // feed, qa, clubs, events, bookmarks

  useEffect(() => {
    if (!user || authLoading) return;

    const init = async () => {
      try {
        await initializeSocket(localStorage.getItem('auth_token'));
        if (user.schoolId) {
          await joinSchoolCommunity(user.schoolId);
        }
      } catch (e) {
        console.warn('Socket connection failed:', e);
      }
    };
    init();
  }, [user, authLoading]);

  const fetchFeed = useCallback(async (pageNum = 1, append = false) => {
    if (!user?.schoolId) return;
    setLoading(true);
    try {
      const res = await listPosts({ page: pageNum, perPage: 20 });
      const payload = res.data || {};
      const posts = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);
      if (append) {
        setFeedPosts((prev) => [...prev, ...posts]);
      } else {
        setFeedPosts(posts);
      }
      const meta = payload.meta || {};
      setPage(meta.page || pageNum);
      setHasMore((meta.page || pageNum) < (meta.totalPages || 1));
    } catch (e) {
      console.error('Failed to fetch feed:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchClubs = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const res = await listClubs({ page: 1, perPage: 50 });
      const payload = res.data || {};
      setClubs(Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []));
    } catch (e) {
      console.error('Failed to fetch clubs:', e);
    }
  }, [user]);

  const fetchEvents = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const res = await listEvents({ page: 1, perPage: 50 });
      const payload = res.data || {};
      setEvents(Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []));
    } catch (e) {
      console.error('Failed to fetch events:', e);
    }
  }, [user]);

  useEffect(() => {
    fetchFeed(1);
    fetchClubs();
    fetchEvents();
  }, [fetchFeed, fetchClubs]);

  const handleNewPost = useCallback(async (payload) => {
    if (!user?.role) {
      throw new Error('User role not available');
    }
    try {
      console.log('USER OBJECT:', JSON.stringify(user));
      const res = await createPost({ ...payload, schoolId: user.schoolId, authorId: user._id, authorRole: user.role, authorName: user.name });
      return res.data || res;
    } catch (e) {
      console.error('Failed to create post:', e);
      throw e;
    }
  }, [user]);

  const handleNewPoll = useCallback(async (payload) => {
    if (!user?.role) {
      throw new Error('User role not available');
    }
    try {
      await createPoll({ ...payload, schoolId: user.schoolId, authorId: user._id, authorRole: user.role, authorName: user.name });
    } catch (e) {
      console.error('Failed to create poll:', e);
      throw e;
    }
  }, [user]);

  const handleAddComment = useCallback(async (postId, body, parentCommentId = null) => {
    if (!user?.role) {
      throw new Error('User role not available');
    }
    try {
      const res = await createComment({ postId, body, parentCommentId, schoolId: user.schoolId, authorId: user._id, authorRole: user.role, authorName: user.name });
      return res.data || res;
    } catch (e) {
      console.error('Failed to add comment:', e);
      throw e;
    }
  }, [user]);

  const handleReaction = useCallback(async (targetId, targetType, reactionType) => {
    try {
      await addReaction({ targetId, targetType, reactionType });
    } catch (e) {
      console.error('Failed to add reaction:', e);
      throw e;
    }
  }, []);

  const handleBookmark = useCallback(async (postId) => {
    try {
      await bookmarkPost(postId);
    } catch (e) {
      console.error('Failed to bookmark:', e);
      throw e;
    }
  }, []);

  const handleDeletePost = useCallback(async (postId) => {
    try {
      await deletePost(postId);
      setFeedPosts((prev) => prev.filter((p) => p._id !== postId));
    } catch (e) {
      console.error('Failed to delete post:', e);
      throw e;
    }
  }, []);

  const handleCreateClub = useCallback(async (payload) => {
    try {
      await createClub(payload);
      fetchClubs();
    } catch (e) {
      console.error('Failed to create club:', e);
      throw e;
    }
  }, [fetchClubs]);

  const handleToggleClub = useCallback(async (clubId) => {
    try {
      await toggleClubMembership(clubId);
      fetchClubs();
    } catch (e) {
      console.error('Failed to toggle club membership:', e);
      throw e;
    }
  }, [fetchClubs]);

  const handleCreateEvent = useCallback(async (payload) => {
    try {
      await createEvent(payload);
      fetchEvents();
    } catch (e) {
      console.error('Failed to create event:', e);
      throw e;
    }
  }, [fetchEvents]);

  const handleRsvpEvent = useCallback(async (eventId) => {
    try {
      await rsvpEvent(eventId);
      fetchEvents();
    } catch (e) {
      console.error('Failed to RSVP event:', e);
      throw e;
    }
  }, [fetchEvents]);

  const value = {
    feedPosts,
    clubs,
    events,
    loading,
    page,
    hasMore,
    activeSpace,
    setActiveSpace,
    fetchFeed: () => fetchFeed(page + 1, true),
    fetchClubs,
    handleNewPost,
    handleNewPoll,
    handleAddComment,
    handleReaction,
    handleBookmark,
    handleDeletePost,
    handleCreateClub,
    handleToggleClub,
    handleCreateEvent,
    handleRsvpEvent,
    fetchEvents,
    user,
  };

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
};