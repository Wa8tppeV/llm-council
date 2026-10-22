import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import './ChatInterface.css';

const FILE_TYPES = '.pdf,.docx,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp';
const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;

export default function ChatInterface({
  conversation, onSendMessage, isLoading, status, error,
}) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const [deep, setDeep] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  function addFiles(more) {
    const chosen = Array.from(more || []);
    const merged = [...files, ...chosen].slice(0, 6);
    if (files.length + chosen.length > 6) {
      setFileError('Bir soruya en fazla 6 dosya eklenebilir.');
    } else if (chosen.some(f => f.size > 12 * 1024 * 1024)) {
      setFileError('Her dosya en fazla 12 MB olabilir.');
    } else if (chosen.some(f => !/\.(pdf|docx|xlsx|csv|txt|md|jpg|jpeg|png|webp)$/i.test(f.name))) {
      setFileError('Bu dosya türü henüz desteklenmiyor.');
    } else {
      setFileError('');
    }
    setFiles(merged.filter(f => f.size <= 12 * 1024 * 1024
      && /\.(pdf|docx|xlsx|csv|txt|md|jpg|jpeg|png|webp)$/i.test(f.name)));
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();
    if ((!input.trim() && !files.length) || isLoading) return;
    const question = input.trim() || 'Ekli dosyaları incele ve temel bulguları özetle.';
    const success = await onSendMessage(question, files, deep);
    if (success) {
      setInput('');
      setFiles([]);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const installed = status?.installed_models || [];
  const activeModels = deep ? installed : (status?.selected_models || []);
  return (
    <div className="chat-interface">
      <header className="council-header">
        <div><strong>Yerel Yapay Zekâ Konseyi</strong><span>Ücretsiz · Ollama · Dosya analizi</span></div>
        <div className={'connection-status ' + (status?.connected ? 'connected' : 'disconnected')}>
          {status?.connected ? '● Yerel bağlantı açık' : '○ Ollama bağlantısını kontrol et'}
        </div>
      </header>

      <div className="messages-container">
        {!conversation ? (
          <div className="empty-state">
            <h2>Yeni konsey görüşmesi</h2>
            <p>Sol menüden yeni bir görüşme oluştur.</p>
          </div>
        ) : conversation.messages.length === 0 ? (
          <div className="empty-state">
            <h2>Bir soru sor veya dosya ekle</h2>
            <p>Modeller bağımsız yanıt verir, eleştirir ve ortak sonucu hazırlar.</p>
          </div>
        ) : (
          conversation.messages.map((msg, index) => (
            <div key={index} className="message-group">
              {msg.role === 'user' ? (
                <div className="user-message">
                  <div className="message-label">Sen</div>
                  <div className="message-content">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {!!msg.files?.length && <div className="attached-list">
                      {msg.files.map(file => (
                        <span className="attached-chip" key={file.id}>📎 {file.name}</span>
                      ))}
                    </div>}
                  </div>
                </div>
              ) : (
                <div className="assistant-message">
                  <div className="message-label">Yapay Zekâ Konseyi</div>
                  {msg.loading?.stage1 && <div className="stage-loading"><div className="spinner" />1. aşama: Modeller ayrı ayrı analiz ediyor…</div>}
                  {msg.stage1 && <Stage1 responses={msg.stage1} />}
                  {msg.loading?.stage2 && <div className="stage-loading"><div className="spinner" />2. aşama: Birbirlerinin yanıtlarını değerlendiriyor…</div>}
                  {msg.stage2 && <Stage2 rankings={msg.stage2}
                    labelToModel={msg.metadata?.label_to_model}
                    aggregateRankings={msg.metadata?.aggregate_rankings} />}
                  {msg.loading?.stage3 && <div className="stage-loading"><div className="spinner" />3. aşama: Başkan model ortak sonucu hazırlıyor…</div>}
                  {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}
                  {!!msg.metadata?.selected_models?.length &&
                    <p className="model-notice">Katılan modeller: {msg.metadata.selected_models.join(', ')}</p>}
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && <div className="loading-indicator">
          <div className="spinner" />Dosyalar işleniyor veya konsey çalışıyor. Büyük modeller daha uzun sürebilir.
        </div>}
        <div ref={endRef} />
      </div>

      {conversation && (
        <form className="input-form council-input" onSubmit={handleSubmit}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
          <div className="council-input-main">
            <div className="model-notice">
              {activeModels.length > 0
                ? activeModels.join(' · ')
                : 'Yerel modeller yüklenemedi'}
            </div>
            {!!files.length && <div className="attached-list">
              {files.map((file, index) => <span className="attached-chip" key={file.name + index}>
                {IMAGE_EXT.test(file.name) ? '🖼️' : '📄'} {file.name}
                <button type="button" title="Dosyayı kaldır" disabled={isLoading}
                  onClick={() => setFiles(prev => prev.filter((_, i) => i !== index))}>×</button>
              </span>)}
            </div>}
            <textarea className="message-input"
              placeholder="Sorunu yaz veya PDF, Word, Excel, fotoğraf sürükleyip bırak…"
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown} disabled={isLoading} rows={3} />
            <div className="composer-bottom">
              <label className="file-picker">
                📎 Dosya ekle
                <input ref={fileRef} type="file" multiple accept={FILE_TYPES}
                  disabled={isLoading}
                  onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
              </label>
              <label className="deep-check" title="30B modeli RAM kullanımı nedeniyle uzun sürebilir">
                <input type="checkbox" checked={deep} disabled={isLoading}
                  onChange={e => setDeep(e.target.checked)} />
                Tüm modellerle derin konsey (30B yavaş)
              </label>
              <button type="submit" className="send-button"
                disabled={(!input.trim() && !files.length) || isLoading}>
                {isLoading ? 'İşleniyor…' : 'Konseye Sor'}
              </button>
            </div>
            {(error || fileError) && <p role="alert" className="council-error">{error || fileError}</p>}
            <p className="local-warning">
              Dosyalar bu bilgisayarda işlenir. PDF taramaları ve görsel ölçüler mutlaka doğrulanmalıdır.
              Destek: PDF, DOCX, XLSX, CSV, TXT, PNG/JPG/WEBP. Dosya başına 12 MB, en çok 6 dosya.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
