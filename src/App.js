// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { auth, provider, db } from './firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
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
  const [editingMsgId, setEditingMsgId] = useState(null); 
  const [searchTerm, setSearchTerm] = useState(""); 
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // --- User Profile 相關狀態 ---
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null); 

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchAllUsers(); 
        fetchCurrentUserData(currentUser.uid); 
      }
    });
    return () => unsubscribe();
  }, []);

  // 【重大修改】：在這裡加入 Chrome 通知邏輯
  useEffect(() => {
    if (!selectedChatId) return;

    // 1. 詢問 Chrome 通知權限
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const q = query(
      collection(db, "chats", selectedChatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      
      // 2. 處理 Chrome "未讀" 通知
      snapshot.docChanges().forEach((change) => {
        // 只針對「新增」的訊息做反應 (避免編輯或收回訊息時也跳通知)
        if (change.type === "added") {
          const newMsg = change.doc.data();
          const isMine = newMsg.senderId === auth.currentUser?.uid;
          
          // 判斷未讀：不是我傳的 且 網頁沒有被使用者觀看中 (失焦) 且 有通知權限
          if (!isMine && !document.hasFocus() && Notification.permission === "granted") {
            const senderName = newMsg.senderEmail.split('@')[0];
            // 觸發系統通知
            new Notification(`NTHU Chat: 新訊息來自 ${senderName}`, {
              body: newMsg.text ? newMsg.text : "傳送了一張圖片 🖼️",
            });
          }
        }
      });

      // 3. 更新畫面上的聊天記錄
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [selectedChatId]);

  useEffect(() => {
    if (!editingMsgId && searchTerm === "") {
      scrollToBottom();
    }
  }, [messages, editingMsgId, searchTerm]);

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

  const fetchCurrentUserData = async (uid) => {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      setCurrentUserData(data);
      setEditName(data.displayName || "");
      setEditAvatar(data.photoURL || "");
      setEditEmail(data.email || "");
      setEditPhone(data.phoneNumber || "");
      setEditAddress(data.address || "");
    }
  };

  const saveUserToFirestore = async (loggedUser) => {
    const userRef = doc(db, "users", loggedUser.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: loggedUser.uid,
        email: loggedUser.email, 
        displayName: loggedUser.displayName || "", 
        photoURL: loggedUser.photoURL || "",
        phoneNumber: "", 
        address: "",     
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
    cancelEdit(); 
    setSearchTerm(""); 
    setIsSearchOpen(false); 
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const textToSend = newMessage.trim();
    if (textToSend === "" || !selectedChatId) return;
    setNewMessage("");
    try {
      if (editingMsgId) {
        await updateDoc(doc(db, "chats", selectedChatId, "messages", editingMsgId), {
          text: textToSend,
          isEdited: true 
        });
        setEditingMsgId(null); 
      } else {
        await addDoc(collection(db, "chats", selectedChatId, "messages"), {
          text: textToSend,
          senderId: auth.currentUser.uid,
          senderEmail: auth.currentUser.email,
          createdAt: serverTimestamp(),
          isEdited: false 
        });
      }
    } catch (error) {
      console.error("操作失敗", error);
      alert("訊息操作失敗，請檢查網路連線！");
      setNewMessage(textToSend); 
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !selectedChatId) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800; 
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6);
        try {
          await addDoc(collection(db, "chats", selectedChatId, "messages"), {
            text: "", 
            imageUrl: compressedBase64, 
            senderId: auth.currentUser.uid,
            senderEmail: auth.currentUser.email,
            createdAt: serverTimestamp(),
            isEdited: false 
          });
        } catch (error) {
          alert("圖片傳送失敗：" + error.message);
        } finally {
          setIsUploading(false); 
        }
      };
    };
    e.target.value = null; 
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 150; 
        let width = img.width;
        let height = img.height;
        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        setEditAvatar(canvas.toDataURL("image/jpeg", 0.7));
      };
    };
    e.target.value = null;
  };

  const saveProfile = async () => {
    setIsUpdatingProfile(true);
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        displayName: editName,
        photoURL: editAvatar,
        email: editEmail,
        phoneNumber: editPhone,
        address: editAddress
      });
      await fetchAllUsers();
      await fetchCurrentUserData(auth.currentUser.uid);
      setIsProfileOpen(false); 
    } catch (error) {
      alert("儲存失敗：" + error.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUnsend = async (msgId) => {
    if (window.confirm("確定要收回這則訊息嗎？")) {
      try {
        await deleteDoc(doc(db, "chats", selectedChatId, "messages", msgId));
        if (editingMsgId === msgId) cancelEdit(); 
      } catch (error) {
        alert("收回失敗：" + error.message);
      }
    }
  };

  const startEdit = (msg) => { setEditingMsgId(msg.id); setNewMessage(msg.text); };
  const cancelEdit = () => { setEditingMsgId(null); setNewMessage(""); };
  const toggleSearch = () => { if (isSearchOpen) setSearchTerm(""); setIsSearchOpen(!isSearchOpen); };

  const handleRegister = async () => { try { const res = await createUserWithEmailAndPassword(auth, email, password); await saveUserToFirestore(res.user); } catch (e) { alert(e.message); } };
  const handleLogin = async () => { try { await signInWithEmailAndPassword(auth, email, password); } catch (e) { alert(e.message); } };
  const handleGoogleLogin = async () => { try { const res = await signInWithPopup(auth, provider); await saveUserToFirestore(res.user); } catch (e) { alert(e.message); } };
  const handleLogout = async () => { await signOut(auth); setSelectedChatId(null); setSelectedChatUser(null); };

  const filteredMessages = messages.filter(m => {
    if (searchTerm.trim() === "") return true;
    return m.text && m.text.toLowerCase().includes(searchTerm.toLowerCase());
  });

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
      {/* Modal 部分維持不變 */}
      {isProfileOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "10px", width: "350px", maxHeight: "90vh", overflowY: "auto", textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0, color: "#333" }}>個人資料設定</h3>
            
            <div style={{ position: "relative", width: "100px", height: "100px", margin: "0 auto 20px" }}>
              {editAvatar ? (
                <img src={editAvatar} alt="avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "2px solid #06C755" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", borderRadius: "50%", backgroundColor: "#ccc", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "2rem" }}>
                  {currentUserData?.email?.charAt(0).toUpperCase()}
                </div>
              )}
              <label style={{ position: "absolute", bottom: 0, right: 0, background: "#06C755", color: "white", borderRadius: "50%", padding: "6px", cursor: "pointer", fontSize: "14px", border: "2px solid white" }}>
                📷
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
              </label>
            </div>

            <div style={{ marginBottom: "12px", textAlign: "left" }}>
              <label style={{ fontSize: "13px", color: "#555", fontWeight: "bold" }}>顯示名稱 (Username)</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "5px", border: "1px solid #ccc" }} placeholder="輸入你的暱稱" />
            </div>

            <div style={{ marginBottom: "12px", textAlign: "left" }}>
              <label style={{ fontSize: "13px", color: "#555", fontWeight: "bold" }}>電子郵件 (Email)</label>
              <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "5px", border: "1px solid #ccc" }} placeholder="example@gmail.com" />
            </div>

            <div style={{ marginBottom: "12px", textAlign: "left" }}>
              <label style={{ fontSize: "13px", color: "#555", fontWeight: "bold" }}>電話號碼 (Phone number)</label>
              <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "5px", border: "1px solid #ccc" }} placeholder="0912-345-678" />
            </div>

            <div style={{ marginBottom: "20px", textAlign: "left" }}>
              <label style={{ fontSize: "13px", color: "#555", fontWeight: "bold" }}>地址 (Address)</label>
              <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "5px", border: "1px solid #ccc" }} placeholder="輸入你的地址" />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
              <button onClick={() => setIsProfileOpen(false)} style={{ padding: "10px 20px", border: "1px solid #ddd", background: "white", borderRadius: "5px", cursor: "pointer", color: "#555", fontWeight: "bold" }}>取消</button>
              <button onClick={saveProfile} disabled={isUpdatingProfile} style={{ padding: "10px 20px", border: "none", borderRadius: "5px", cursor: "pointer", background: "#06C755", color: "white", fontWeight: "bold" }}>
                {isUpdatingProfile ? "儲存中..." : "儲存設定"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 側邊欄與聊天區域維持不變 */}
      <div className="sidebar">
        <div className="sidebar-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>好友列表</span>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="logout-btn" onClick={() => setIsProfileOpen(true)} title="個人資料設定">⚙️</button>
            <button className="logout-btn" onClick={handleLogout}>登出</button>
          </div>
        </div>
        <div className="user-list">
          {users.map(u => (
            <div key={u.uid} className={`user-item ${selectedChatUser?.uid === u.uid ? 'active' : ''}`} onClick={() => startChat(u)}>
              {u.photoURL ? (
                <img src={u.photoURL} alt="avatar" className="user-avatar" style={{ objectFit: "cover", padding: 0 }} />
              ) : (
                <div className="user-avatar">{u.email.charAt(0).toUpperCase()}</div>
              )}
              <div>{u.displayName || u.email.split('@')[0]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-area">
        {selectedChatId ? (
          <>
            <div className="chat-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{selectedChatUser?.displayName || selectedChatUser?.email.split('@')[0]}</span>
              <button onClick={toggleSearch} style={{ background: isSearchOpen ? "#e0e0e0" : "transparent", border: "none", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center" }} title="搜尋訊息">🔍</button>
            </div>

            {isSearchOpen && (
              <div style={{ padding: "10px 20px", backgroundColor: "#ffffff", borderBottom: "1px solid #e0e0e0" }}>
                <input type="text" placeholder="🔍 搜尋此聊天室的訊息..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus style={{ width: "100%", padding: "8px 15px", borderRadius: "20px", border: "1px solid #ddd", outline: "none", fontSize: "14px", backgroundColor: "#f9f9f9" }} />
              </div>
            )}
            
            <div className="messages-container">
              {filteredMessages.map(m => {
                const isMine = m.senderId === auth.currentUser.uid;
                const isEditingThis = editingMsgId === m.id;
                
                const senderInfo = isMine ? currentUserData : users.find(u => u.uid === m.senderId);
                const displayName = senderInfo?.displayName || m.senderEmail.split('@')[0];
                const avatar = senderInfo?.photoURL;

                return (
                  <div key={m.id} className={`message-wrapper ${isMine ? 'mine' : 'other'}`} style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', maxWidth: '100%' }}>
                    
                    {!isMine && (
                      <div style={{ marginRight: '10px', marginBottom: '15px' }}>
                        {avatar ? (
                           <img src={avatar} alt="avatar" style={{ width: "35px", height: "35px", borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                           <div style={{ width: "35px", height: "35px", borderRadius: "50%", backgroundColor: "#ccc", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "bold" }}>
                             {m.senderEmail.charAt(0).toUpperCase()}
                           </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '70%', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                      <div className="message-sender" style={{ marginLeft: 0, marginRight: 0 }}>{displayName}</div>
                      
                      <div style={{ display: "flex", alignItems: "flex-end", gap: "5px", flexDirection: isMine ? "row-reverse" : "row" }}>
                        <div className="message-bubble" style={{ opacity: isEditingThis ? 0.5 : 1, padding: m.imageUrl ? "5px" : "10px 15px", backgroundColor: m.imageUrl ? "transparent" : "" }}>
                          {m.imageUrl ? (
                            <img src={m.imageUrl} alt="chat-img" style={{ maxWidth: "200px", borderRadius: "10px", display: "block" }} />
                          ) : (
                            m.text
                          )}
                          {m.isEdited && !m.imageUrl && <span style={{ fontSize: "10px", color: isMine ? "#444" : "#999", marginLeft: "6px" }}>(已編輯)</span>}
                        </div>

                        {isMine && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <button onClick={() => handleUnsend(m.id)} style={{ border: "none", background: "transparent", color: "#ff4d4f", fontSize: "12px", cursor: "pointer", padding: "0" }}>收回</button>
                            {!m.imageUrl && (
                              <button onClick={() => startEdit(m)} style={{ border: "none", background: "transparent", color: "#666", fontSize: "12px", cursor: "pointer", padding: "0" }}>編輯</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {searchTerm && filteredMessages.length === 0 && (
                <div style={{ textAlign: "center", color: "#666", marginTop: "20px" }}>找不到包含「{searchTerm}」的訊息</div>
              )}
              <div ref={messagesEndRef} /> 
            </div>

            {editingMsgId && (
              <div style={{ backgroundColor: "#e5f9ed", padding: "8px 20px", fontSize: "13px", color: "#06C755", display: "flex", justifyContent: "space-between", borderTop: "1px solid #ddd" }}>
                <span>✏️ 正在編輯訊息...</span>
                <button onClick={cancelEdit} style={{ background: "none", border: "none", color: "#666", cursor: "pointer" }}>✖ 取消</button>
              </div>
            )}

            <form className="input-area" onSubmit={sendMessage} style={{ alignItems: "center" }}>
              <input type="file" accept="image/*" id="image-upload" style={{ display: "none" }} onChange={handleImageUpload} />
              <button type="button" onClick={() => document.getElementById('image-upload').click()} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", padding: "0 10px", opacity: (isSearchOpen || isUploading) ? 0.5 : 1 }} disabled={isSearchOpen || isUploading} title="傳送圖片">
                {isUploading ? "⏳" : "🖼️"}
              </button>
              <input className="chat-input" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={editingMsgId ? "修改訊息..." : "輸入訊息..."} disabled={isSearchOpen || isUploading} />
              <button type="submit" className="send-btn" disabled={!newMessage.trim() || isSearchOpen || isUploading}>
                {editingMsgId ? "儲存" : "傳送"}
              </button>
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