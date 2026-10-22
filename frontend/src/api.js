/**
 * API client for the LLM Council backend.
 */

const API_BASE = 'http://127.0.0.1:8001';

export const api = {
  async status() {
    const response = await fetch(`${API_BASE}/api/status`);
    if (!response.ok) throw new Error('Ollama bağlantısı kontrol edilemedi');
    return response.json();
  },

  async uploadFile(conversationId, file) {
    const form = new FormData();
    form.append('file', file, file.name);
    const response = await fetch(`${API_BASE}/api/conversations/${conversationId}/files`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      let detail = 'Dosya yüklenemedi';
      try {
        const data = await response.json();
        detail = data.detail || detail;
      } catch { /* non-JSON error */ }
      throw new Error(detail);
    }
    return response.json();
  },

  /**
   * List all conversations.
   */
  async listConversations() {
    const response = await fetch(`${API_BASE}/api/conversations`);
    if (!response.ok) {
      throw new Error('Failed to list conversations');
    }
    return response.json();
  },

  /**
   * Create a new conversation.
   */
  async createConversation() {
    const response = await fetch(`${API_BASE}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }
    return response.json();
  },

  /**
   * Get a specific conversation.
   */
  async getConversation(conversationId) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`
    );
    if (!response.ok) {
      throw new Error('Failed to get conversation');
    }
    return response.json();
  },

  /**
   * Send a message in a conversation.
   */
  async sendMessage(conversationId, content) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    return response.json();
  },

  /**
   * Send a message and receive streaming updates.
   * @param {string} conversationId - The conversation ID
   * @param {string} content - The message content
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, fileIds, deep, onEvent) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content, file_ids: fileIds, deep }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Network chunks may split a single SSE event or JSON string.
    const consumeEvents = () => {
      let eventEnd;
      while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, eventEnd);
        buffer = buffer.slice(eventEnd + 2);
        for (const line of block.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            onEvent(event.type, event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      consumeEvents();
    }
    buffer += decoder.decode();
    if (buffer.trim()) buffer += '\n\n';
    consumeEvents();
  },
};
