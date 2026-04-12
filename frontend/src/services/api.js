const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"; // backend

export async function firstChat(formData) {
  const res = await fetch(`${BASE_URL}/first_chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  return res.json(); // expects { image: "base64 or url" }
}

export async function chat(prompt) {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  return res.json(); // expects { image: "base64 or url" }
}

export async function modifyAsset(documentId, prompt) {
  const res = await fetch(`${BASE_URL}/modify_asset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ document_id: documentId, prompt }),
  });

  return res.json();
}

export async function listAssets(documentId) {
  const res = await fetch(`${BASE_URL}/list_assets/${documentId}`);
  return res.json();
}

export function getDxfUrl(documentId) {
  return `${BASE_URL}/get_dxf/${documentId}`;
}

export async function getTaskStatus(taskId) {
  const res = await fetch(`${BASE_URL}/status/${taskId}`);
  return res.json();
}
