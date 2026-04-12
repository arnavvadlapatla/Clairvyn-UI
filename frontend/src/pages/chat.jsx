import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { modifyAsset, listAssets, firstChat, chat, getTaskStatus } from '../services/api';
import DXFViewer from '../components/DXFViewer';

export default function Chat() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([{ role: 'assistant', content: `I've generated your floor plan based on: ${state?.prompt}` }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [documentId, setDocumentId] = useState(state?.documentId || null);
  const [assets, setAssets] = useState([]);
  const [dxfKey, setDxfKey] = useState(Date.now()); // cache-busting key for PNG refresh
  const chatEndRef = useRef(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load assets when documentId changes
  useEffect(() => {
    if (documentId) {
      listAssets(documentId).then(data => {
        if (data.assets) {
          setAssets(data.assets);
        }
      }).catch(err => console.error('Failed to load assets:', err));
    }
  }, [documentId, dxfKey]);

  // Polling helper
  const pollTask = async (taskId) => {
    let attempts = 0;
    const maxAttempts = 120; // ~8 minutes
    while (attempts < maxAttempts) {
      const result = await getTaskStatus(taskId);
      if (result.success) return result;
      if (result.status === 'FAILURE') throw new Error(result.error || 'Task failed');
      attempts++;
      await new Promise(r => setTimeout(r, 4000));
    }
    throw new Error('Generation timed out.');
  };

  // Initial generation trigger
  useEffect(() => {
    if (state?.prompt && !documentId && !isLoading) {
      const startInitialGen = async () => {
        setIsLoading(true);
        try {
          const initRes = await firstChat(state.formData || {});
          if (initRes.success && initRes.task_id) {
            const finalResult = await pollTask(initRes.task_id);
            setDocumentId(finalResult.document_id);
            setDxfKey(Date.now());
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: 'I have finished generating your floor plan! You can see it on the left.',
              type: 'success'
            }]);
          } else {
            throw new Error(initRes.error || 'Failed to start generation');
          }
        } catch (err) {
          console.error('Initial Gen Error:', err);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Failed to generate floor plan: ${err.message}`, 
            type: 'error' 
          }]);
        } finally {
          setIsLoading(false);
        }
      };
      startInitialGen();
    }
  }, [state, documentId]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      if (documentId) {
        // Try asset modification first
        const initRes = await modifyAsset(documentId, userMessage);

        if (initRes.success && initRes.task_id) {
          const result = await pollTask(initRes.task_id);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: result.result?.response || 'Modification complete.',
            type: 'success'
          }]);
          // Refresh viewer
          setDxfKey(Date.now());
          if (result.result?.assets) {
            setAssets(result.result.assets);
          }
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: initRes.error || 'Sorry, I could not complete that modification.',
            type: 'error'
          }]);
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'No floor plan is loaded. Please generate one first.',
          type: 'error'
        }]);
      }
    } catch (err) {
      console.error('Error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'An error occurred while processing your request.',
        type: 'error'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFile = (type) => {
    if (!documentId) {
      alert("No floor plan available.");
      return;
    }

    const url = `${BASE_URL}/download/${documentId}/${type}`;

    // Direct browser download (simpler + cleaner)
    const a = document.createElement("a");
    a.href = url;
    a.download = `${documentId}.${type}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };


  // No longer using static floorPlanImageUrl; DXFViewer fetches the DXF directly.

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-6xl mx-auto animate-fade-in">

        {/* Header with Logo */}
        <div className="text-center mb-8">
          <img
            src="/clairvyn-logo.png"
            alt="Clairvyn"
            className="h-16 mx-auto mb-4"
          />
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full border border-green-200">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Floor plan generated successfully!</span>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: Floor Plan Visualization */}
          <div className="bg-white rounded-3xl p-6 shadow-2xl shadow-blue-500/10 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
              </svg>
              Floor Plan
            </h3>

            <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200 overflow-hidden" style={{ minHeight: 360 }}>
              {documentId ? (
                <DXFViewer
                  documentId={documentId}
                  refreshKey={dxfKey}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full space-y-2">
                  <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">No floor plan loaded</p>
                </div>
              )}
            </div>

            {/* Asset List */}
            {assets.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-600 mb-2">Assets in this plan:</h4>
                <div className="flex flex-wrap gap-2">
                  {assets.map((asset, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200"
                    >
                      {asset.asset_name} ({asset.room_id})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Chat */}
          <div className="flex flex-col">
            <div className="bg-white rounded-3xl shadow-xl shadow-blue-500/10 border border-gray-100 flex flex-col flex-1 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
                <h2 className="text-xl font-bold">Edit Floor Plan</h2>
                <p className="text-sm text-blue-100">Type commands like "move the sofa 2m right" or "remove the bed"</p>
              </div>

              <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[400px]">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl ${msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : msg.type === 'success'
                          ? 'bg-green-50 text-green-800 border border-green-200 rounded-bl-none'
                          : msg.type === 'error'
                            ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-none'
                            : 'bg-gray-100 text-gray-800 rounded-bl-none'
                        }`}
                    >
                      {msg.type === 'success' && (
                        <span className="inline-block mr-1">✅</span>
                      )}
                      {msg.type === 'error' && (
                        <span className="inline-block mr-1">❌</span>
                      )}
                      <p className="text-sm leading-relaxed inline">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-500 px-4 py-3 rounded-2xl rounded-bl-none">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        <span className="text-sm">Processing...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef}></div>
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-white rounded-2xl shadow-lg shadow-blue-500/10 p-3 border border-gray-100 mt-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="e.g. move the sofa 2m to the right..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={isLoading}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/50 transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:transform-none"
                >
                  <span>Send</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center mt-8 flex-wrap">
          <button
            onClick={() => downloadFile("dxf")}
            disabled={!documentId}
            className="px-6 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition disabled:opacity-50"
          >
            Download DXF
          </button>

          <button
            onClick={() => downloadFile("png")}
            disabled={!documentId}
            className="px-6 py-3 bg-white border-2 border-green-600 text-green-600 rounded-xl font-semibold hover:bg-green-50 transition disabled:opacity-50"
          >
            Download PNG
          </button>

          <button
            onClick={() => navigate('/form')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition"
          >
            Generate New Plan
          </button>

        </div>
      </div>
    </div>
  );
}
