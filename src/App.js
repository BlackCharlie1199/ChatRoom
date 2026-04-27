// src/App.js
import React, { useState, useEffect } from 'react';
import { auth, provider, db } from './firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
// 【修改這裡】：多匯入 deleteDoc 和 updateDoc
import { doc, setDoc, getDoc, collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import './App.css'; 

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  
  const [users, setUsers] = useState([]); 
  const [selectedChatUser, setSelectedChatUser] = useState(null); 
  const [selectedChatId, setSelectedChatId] = useState(null); 
  const [messages, setMessages] = useState([]); 
  const [newMessage, setNewMessage] = useState(""); 

  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) fetchAllUsers(); 
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedChatId) return;
    const q = query(
      collection(db, "chats", selectedChatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [selectedChatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchAllUsers = async () => {
    const q = query(collection(db, "users"));
    const querySnapshot = await getDocs(q);
    const usersList = [];
    querySnapshot.forEach((doc) => {
      if (doc.id !== auth.currentUser.uid) {
        usersList.push({ id: doc.id, ...doc.data() });
      }
    });
    setUsers(usersList);
  };

  const saveUserToFirestore = async (loggedUser) => {
    const userRef = doc(db, "users", loggedUser.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: loggedUser.uid,
        email: loggedUser.email,
        displayName: loggedUser.displayName || "匿名使用者",
        photoURL: loggedUser.photoURL || "",
        createdAt: serverTimestamp()
      });
    }
  };

  const startChat = async (targetUser) => {
    const chatId = [auth.currentUser.uid, targetUser.uid].sort().join("_");
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        members: [auth.currentUser.uid, targetUser.uid],
        createdAt: serverTimestamp(),
        type: "private" 
      });
    }
    setSelectedChatId(chatId);
    setSelectedChatUser(targetUser); 
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const textToSend = newMessage.trim();
    if (textToSend === "" || !selectedChatId) return;
    setNewMessage("");

    try {
      await addDoc(collection(db, "chats", selectedChatId, "messages"), {
        text: textToSend,
        senderId: auth.currentUser.uid,
        senderEmail: auth.currentUser.email,
        createdAt: serverTimestamp(),
        isEdited: false // 新增時標記為未編輯
      });
    } catch (error) {
      console.error("發送失敗", error);
      alert("訊息發送失敗，請檢查網路連線！");
      setNewMessage(textToSend); 
    }
  };

  // 【新增邏輯】：收回訊息
  const handleUnsend = async (msgId) => {
    // 再次確認是否要收回
    if (window.confirm("確定要收回這則訊息嗎？")) {
      try {
        await deleteDoc(doc(db, "chats", selectedChatId, "messages", msgId));
      } catch (error) {
        alert("收回失敗：" + error.message);
      }
    }
  };

  // 【新增邏輯】：編輯訊息
  const handleEdit = async (msgId, currentText) => {
    // 彈出對話框讓使用者修改文字
    const newText = window.prompt("編輯訊息：", currentText);
    
    // 確保有輸入新文字，且跟原本的不一樣才去更新資料庫
    if (newText !== null && newText.trim() !== "" && newText !== currentText) {
      try {
        await updateDoc(doc(db, "chats", selectedChatId, "messages", msgId), {
          text: newText.trim(),
          isEdited: true // 標記這則訊息已經被編輯過了
        });
      } catch (error) {
        alert("編輯失敗：" + error.message);
      }
    }
  };

  // Auth Functions
  const handleRegister = async () => { try { const res = await createUserWithEmailAndPassword(auth, email, password); await saveUserToFirestore(res.user); } catch (e) { alert(e.message); } };
  const handleLogin = async () => { try { await signInWithEmailAndPassword(auth, email, password); } catch (e) { alert(e.message); } };
  const handleGoogleLogin = async () => { try { const res = await signInWithPopup(auth, provider); await saveUserToFirestore(res.user); } catch (e) { alert(e.message); } };
  const handleLogout = async () => { await signOut(auth); setSelectedChatId(null); setSelectedChatUser(null); };

  if (!user) {
    return (
      <div className="login-container">
        <h1 style={{ color: "#06C755" }}>NTHU Chat</h1>
        <h3 style={{ color: "#555" }}>請先登入</h3>
        <input className="login-input" type="email" placeholder="信箱" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="login-input" type="password" placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div>
          <button className="btn-primary" onClick={handleLogin}>登入</button>
          <button className="btn-primary" onClick={handleRegister} style={{ marginLeft: "10px", backgroundColor: "#555" }}>註冊</button>
        </div>
        <hr style={{ margin: "20px 0", border: "0.5px solid #eee" }} />
        <button onClick={handleGoogleLogin} style={{ width: "100%", padding: "10px", background: "white", border: "1px solid #ddd", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>
          使用 Google 登入
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <span>好友列表</span>
          <button className="logout-btn" onClick={handleLogout}>登出</button>
        </div>
        <div className="user-list">
          {users.map(u => (
            <div key={u.uid} className={`user-item ${selectedChatUser?.uid === u.uid ? 'active' : ''}`} onClick={() => startChat(u)}>
              <div className="user-avatar">{u.email.charAt(0).toUpperCase()}</div>
              <div>{u.displayName || u.email.split('@')[0]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-area">
        {selectedChatId ? (
          <>
            <div className="chat-header">
              {selectedChatUser?.displayName || selectedChatUser?.email}
            </div>
            
            <div className="messages-container">
              {messages.map(m => {
                const isMine = m.senderId === auth.currentUser.uid;
                return (
                  <div key={m.id} className={`message-wrapper ${isMine ? 'mine' : 'other'}`}>
                    <div className="message-sender">{m.senderEmail.split('@')[0]}</div>
                    
                    {/* 【修改畫面】：將泡泡和按鈕包在一起排版 */}
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "5px", flexDirection: isMine ? "row-reverse" : "row" }}>
                      
                      <div className="message-bubble">
                        {m.text}
                        {/* 如果被編輯過，顯示一個小小的標記 */}
                        {m.isEdited && <span style={{ fontSize: "10px", color: isMine ? "#444" : "#999", marginLeft: "6px" }}>(已編輯)</span>}
                      </div>

                      {/* 如果是我的訊息，才顯示編輯與收回的按鈕 */}
                      {isMine && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <button onClick={() => handleUnsend(m.id)} style={{ border: "none", background: "transparent", color: "#ff4d4f", fontSize: "12px", cursor: "pointer", padding: "0" }}>收回</button>
                          <button onClick={() => handleEdit(m.id, m.text)} style={{ border: "none", background: "transparent", color: "#666", fontSize: "12px", cursor: "pointer", padding: "0" }}>編輯</button>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} /> 
            </div>

            <form className="input-area" onSubmit={sendMessage}>
              <input className="chat-input" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="輸入訊息..." />
              <button type="submit" className="send-btn" disabled={!newMessage.trim()}>傳送</button>
            </form>
          </>
        ) : (
          <div className="empty-chat">請選擇左側的好友開始聊天</div>
        )}
      </div>
    </div>
  );
}

export default App;