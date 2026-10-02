import os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="GemmaGraph Local API")

# Allow the React frontend to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DirectoryRequest(BaseModel):
    path: str

class AgentRequest(BaseModel):
    file_path: str
    user_prompt: str

def generate_code_graph(root_path: str):
    """Walks the directory and builds a node/edge graph representation."""
    if not os.path.exists(root_path):
        raise HTTPException(status_code=404, detail="Directory not found")

    nodes = []
    edges = []
    
    for dirpath, dirnames, filenames in os.walk(root_path):
        # Skip hidden directories like .git
        dirnames[:] = [d for d in dirnames if not d.startswith('.')]
        
        current_node_id = dirpath
        if dirpath == root_path:
            nodes.append({"id": current_node_id, "label": os.path.basename(root_path), "type": "root"})
        
        # Create edges to subdirectories
        for dirname in dirnames:
            child_path = os.path.join(dirpath, dirname)
            nodes.append({"id": child_path, "label": dirname, "type": "folder"})
            edges.append({"source": current_node_id, "target": child_path})
            
        # Create edges to files
        for filename in filenames:
            if not filename.startswith('.'):
                file_path = os.path.join(dirpath, filename)
                nodes.append({"id": file_path, "label": filename, "type": "file"})
                edges.append({"source": current_node_id, "target": file_path})
                
    return {"nodes": nodes, "edges": edges}

def read_local_file(filepath: str):
    """Reads the raw code from the selected file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {str(e)}"

@app.post("/api/parse-repo")
async def parse_repository(req: DirectoryRequest):
    """Endpoint to trigger the repository parsing."""
    try:
        graph_data = generate_code_graph(req.path)
        return {"status": "success", "data": graph_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/draft-fix")
async def draft_fix_with_gemma(req: AgentRequest):
    """Connects to the local Gemma 4 model via Ollama."""
    
    # 1. Read the selected file from disk
    file_content = read_local_file(req.file_path)
    
    # 2. Format the specific Gemma 4 prompt
    system_prompt = "<|think|>\nYou are an elite offline Software Engineering Agent. Review the code provided and fulfill the user's request. Output ONLY the modified code and brief reasoning."
    user_message = f"User Request: {req.user_prompt}\n\nTarget File ({req.file_path}):\n```\n{file_content}\n```"

    # 3. Send to Local Ollama Server
    ollama_payload = {
        "model": "gemma4:e4b",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "stream": False,
        "options": {
            "temperature": 1.0,
            "top_p": 0.95,
            "top_k": 64
        }
    }

    try:
        response = requests.post("http://localhost:11434/api/chat", json=ollama_payload)
        response.raise_for_status()
        
        # Extract the model's reply
        agent_reply = response.json()["message"]["content"]
        return {"status": "success", "reply": agent_reply}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ollama inference failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)