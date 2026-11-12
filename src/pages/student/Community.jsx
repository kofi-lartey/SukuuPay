import React, { useState } from 'react';
import { Users, Calendar, Trophy, Megaphone, MessageCircle, Heart, Send, Plus, Filter, Bookmark } from 'lucide-react';
import { useCommunity } from '../../context/CommunityContext';
import { useCommunityFeed } from '../../hooks/useCommunity';
import FeedSkeleton from '../../components/community/FeedSkeleton';
import PostCard from '../../components/community/PostCard';
import PostComposer from '../../components/community/PostComposer';
import FeedContainer from '../../components/community/FeedContainer';
import ClubDetail from '../../components/community/ClubDetail';
import ClubChat from '../../components/community/ClubChat';
import CreateClubDialog from '../../components/community/CreateClubDialog';
import CreateEventDialog from '../../components/community/CreateEventDialog';
import StudyRoomWidget from '../../components/community/StudyRoomWidget';

const TABS = [
  { key: 'feed', label: 'Feed', icon: Megaphone },
  { key: 'clubs', label: 'Clubs', icon: Users },
  { key: 'events', label: 'Events', icon: Calendar },
  { key: 'chat', label: 'Chat', icon: MessageCircle },
  { key: 'bookmarks', label: 'Saved', icon: Bookmark },
];

const StudentCommunity = () => {
  const { activeSpace, setActiveSpace, clubs, events, loading: contextLoading, page, hasMore, fetchFeed, handleNewPost, handleNewPoll, handleReaction, handleAddComment, handleCreateEvent, handleRsvpEvent } = useCommunity();
  const communityCtx = useCommunity();
  const { posts, loading: feedLoading, hasMore: feedHasMore, loadMore } = useCommunityFeed();

  const [tab, setTab] = useState('feed');
  const [selectedClub, setSelectedClub] = useState(null);
  const [newPost, setNewPost] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [showCreateClub, setShowCreateClub] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  const handleTabChange = (key) => {
    setActiveSpace(key);
    setTab(key);
  };

  const handleCreatePost = async (payload) => {
    try {
      await handleNewPost(payload);
      setShowComposer(false);
    } catch (e) {
      console.error('Failed to create post:', e);
    }
  };

  const handleCreatePoll = async (payload) => {
    try {
      await handleNewPoll(payload);
      setShowComposer(false);
    } catch (e) {
      console.error('Failed to create poll:', e);
    }
  };

  const handleReact = async (targetId, targetType, reactionType) => {
    return handleReaction(targetId, targetType, reactionType);
  };

  const handleAddCommentLocal = async (postId, body, parentId) => {
    return handleAddComment(postId, body, parentId);
  };

  const handleBookmark = async (postId) => {
    try {
      await communityCtx.handleBookmark(postId);
      await setActiveSpace('bookmarks');
    } catch (e) {
      console.error('Failed to bookmark:', e);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await communityCtx.handleDeletePost(postId);
      await setActiveSpace('feed');
    } catch (e) {
      console.error('Failed to delete post:', e);
    }
  };

  const handleCreateClub = async (payload) => {
    try {
      await communityCtx.handleCreateClub(payload);
      await setActiveSpace('clubs');
    } catch (e) {
      console.error('Failed to create club:', e?.response?.data || e.message);
    }
  };

  const handleToggleClub = async (clubId) => {
    try {
      await communityCtx.handleToggleClub(clubId);
      await setActiveSpace('clubs');
    } catch (e) {
      console.error('Failed to toggle club:', e);
    }
  };

  const handleCreateRoom = async (roomData) => {
    return null;
  };

  const handleJoinRoom = async (roomData) => {
    return null;
  };

  const handleLeaveRoom = async () => {
    return null;
  };

  const activeTab = tab;

  return (
    <>
    <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">Community</h1>
            <p className="text-[13px] font-semibold text-slate-500">
              {activeSpace === 'feed' ? 'School campus feed' : activeSpace === 'clubs' ? 'Clubs & study rooms' : activeSpace === 'chat' ? 'Community chat' : 'Saved posts'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTabChange(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-bold transition ${active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                <Icon className="h-3.5 w-3.5" />{t.label}
              </button>
            );
          })}
        </div>

        {activeSpace === 'feed' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {showComposer ? (
                <div className="space-y-3">
                  <PostComposer
                    onSubmit={handleCreatePost}
                    onCancel={() => setShowComposer(false)}
                  />
                  <PostComposer
                    initialBody={newPost}
                    onSubmit={handleCreatePoll}
                    onCancel={() => setShowComposer(false)}
                  />
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    placeholder="Share something with the community..."
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]"
                  />
                  <button
                    onClick={() => setShowComposer(true)}
                    className="rounded-xl bg-teal-600 px-3 py-2 text-white"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <FeedContainer loading={feedLoading} hasMore={feedHasMore} onLoadMore={loadMore}>
              {(Array.isArray(posts) ? posts : []).map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  onReact={handleReact}
                  onAddComment={handleAddCommentLocal}
                  onAcceptAnswer={async () => {}}
                  onDeleteComment={async () => {}}
                  onDeletePost={async () => {}}
                  onBookmark={handleBookmark}
                />
              ))}
              {feedLoading && <FeedSkeleton count={3} />}
            </FeedContainer>
          </div>
        )}

        {activeSpace === 'clubs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-extrabold text-ink">Clubs</h2>
              <button
                onClick={() => setShowCreateClub(true)}
                className="rounded-xl bg-teal-600 px-3 py-2 text-[12px] font-bold text-white"
              >
                + Create Club
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clubs.map((c) => (
              <ClubDetail
                key={c._id}
                club={c}
                onJoin={handleToggleClub}
                onLeave={handleToggleClub}
                onOpenChat={() => { setSelectedClub(c._id); setActiveSpace('chat'); setTab('chat'); }}
              />
            ))}
            </div>
            {clubs.length === 0 && (
              <p className="text-[12px] text-slate-400 text-center py-8">No clubs yet. Create one to get started!</p>
            )}
          </div>
        )}

        {activeSpace === 'events' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-extrabold text-ink">Upcoming Events</h2>
              <button
                onClick={() => setShowCreateEvent(true)}
                className="rounded-xl bg-teal-600 px-3 py-2 text-[12px] font-bold text-white"
              >
                + Create Event
              </button>
            </div>
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-[13px] font-extrabold text-ink">{e.title}</h3>
                      <p className="text-[11px] text-slate-500 mt-1">{new Date(e.startAt).toLocaleString()}</p>
                      {e.location && <p className="text-[11px] text-slate-400 mt-0.5">{e.location}</p>}
                      {e.isVirtual && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1 inline-block">Virtual</span>}
                    </div>
                    <button
                      onClick={() => handleRsvpEvent(e._id)}
                      className="rounded-lg bg-teal-50 px-3 py-1.5 text-[11px] font-bold text-teal-700 hover:bg-teal-100"
                    >
                      RSVP ({e.rsvpIds ? e.rsvpIds.length : 0})
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {events.length === 0 && (
              <p className="text-[12px] text-slate-400 text-center py-8">No upcoming events. Create one!</p>
            )}
          </div>
        )}

        {activeSpace === 'chat' && (
          <div className="space-y-4">
            {clubs.length > 0 && !selectedClub && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[13px] font-bold text-slate-700 mb-2">Select a club to chat:</p>
                <div className="flex flex-wrap gap-2">
                  {clubs.map((c) => (
                    <button
                      key={c._id}
                      onClick={() => setSelectedClub(c._id)}
                      className="rounded-xl bg-slate-100 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-700"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selectedClub && (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedClub(null)}
                    className="text-[12px] font-bold text-teal-600 hover:underline"
                  >
                    Back to clubs
                  </button>
                  <span className="text-[12px] text-slate-500">
                    {clubs.find(c => c._id === selectedClub)?.name || 'Club Chat'}
                  </span>
                </div>
                <ClubChat clubId={selectedClub} />
              </>
            )}
            {clubs.length === 0 && (
              <p className="text-[12px] text-slate-400 text-center py-8">No clubs yet. Create one first!</p>
            )}
          </div>
        )}

        {activeSpace === 'bookmarks' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[13px] text-slate-500">Saved posts and polls</p>
              <p className="text-[11px] text-slate-400 text-center py-4">Your bookmarked content will appear here</p>
            </div>
          </div>
        )}
      </div>
      <CreateClubDialog open={showCreateClub} onClose={() => setShowCreateClub(false)} onSubmit={handleCreateClub} />
      <CreateEventDialog open={showCreateEvent} onClose={() => setShowCreateEvent(false)} onSubmit={handleCreateEvent} />
    </>
  );
};

export default StudentCommunity;