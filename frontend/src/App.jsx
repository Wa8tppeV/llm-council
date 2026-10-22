import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import { api } from './api';
import './App.css';

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    loadConversations();
    api.status().then(setStatus).catch(() => setStatus({ connected: false }));
  }, []);

  useEffect(() => {
    if (currentConversationId) loadConversation(currentConversationId);
  }, [currentConversationId]);

  async function loadConversations() {
    try { setConversations(await api.listConversations()); }
    catch (e) { setError(e.message); }
  }

  async function loadConversation(id) {
    try { setCurrentConversation(await api.getConversation(id)); }
    catch (e) { setError(e.message); }
  }

  async function handleNewConversation() {
    if (isLoading) return;
    try {
      const c = await api.createConversation();
      setConversations(prev => [
        { id: c.id, created_at: c.created_at, title: c.title,
          message_count: 0 }, ...prev,
      ]);
      setCurrentConversationId(c.id);
      setCurrentConversation(c);
      setError('');
    } catch (e) { setError(e.message); }
  }

  async function handleSendMessage(content, files = [], deep = false) {
    if (!currentConversationId || isLoading) return false;
    setIsLoading(true);
    setError('');
    let addedOptimistic = false;
    let succeeded = false;
    try {
      const attached = [];
      for (const file of files) {
        const result = await api.uploadFile(currentConversationId, file);
        attached.push(result);
      }
      const fileIds = attached.map(f => f.id);
      setCurrentConversation(prev => ({
        ...prev,
        messages: [...prev.messages,
          { role: 'user', content,
            files: attached.map(({ id, name, kind }) => ({ id, name, kind })) },
          { role: 'assistant', stage1: null, stage2: null, stage3: null,
            metadata: null, loading: { stage1: false, stage2: false, stage3: false } },
        ],
      }));
      addedOptimistic = true;
      let streamedError = null;
      await api.sendMessageStream(currentConversationId, content, fileIds, deep, (type, event) => {
        if (type === 'title_complete') {
          loadConversations();
          return;
        }
        if (type === 'error') {
          streamedError = event.message || 'Konsey hatası';
          return;
        }
        if (type === 'complete') {
          succeeded = true;
          loadConversations();
          return;
        }
        setCurrentConversation(prev => {
          if (!prev) return prev;
          const messages = [...prev.messages];
          const last = { ...messages[messages.length - 1] };
          const loading = { ...last.loading };
          switch (type) {
            case 'stage1_start': loading.stage1 = true; break;
            case 'stage1_complete':
              last.stage1 = event.data;
              loading.stage1 = false;
              break;
            case 'stage2_start': loading.stage2 = true; break;
            case 'stage2_complete':
              last.stage2 = event.data;
              last.metadata = event.metadata;
              loading.stage2 = false;
              break;
            case 'stage3_start': loading.stage3 = true; break;
            case 'stage3_complete':
              last.stage3 = event.data;
              loading.stage3 = false;
              break;
            default: return prev;
          }
          last.loading = loading;
          messages[messages.length - 1] = last;
          return { ...prev, messages };
        });
      });
      if (streamedError) throw new Error(streamedError);
      if (!succeeded) throw new Error('Konsey yanıt akışı tamamlanmadı');
      await loadConversation(currentConversationId);
      return true;
    } catch (e) {
      setError(e.message || 'İşlem başarısız');
      if (addedOptimistic) await loadConversation(currentConversationId);
      return false;
    } finally {
      setIsLoading(false);
      api.status().then(setStatus).catch(() => {});
    }
  }

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={id => { if (!isLoading) setCurrentConversationId(id); }}
        onNewConversation={handleNewConversation}
      />
      <ChatInterface
        conversation={currentConversation}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        status={status}
        error={error}
      />
    </div>
  );
}

export default App;
