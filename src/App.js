// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { auth, provider, db } from './firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, getDocs, deleteDoc, updateDoc, where, arrayUnion } from 'firebase/firestore';
import './App.css'; 

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '🙏'];
// 【重要】：記得確認這裡是你申請的真實 API Key
const GIPHY_API_KEY = process.env.REACT_APP_GIPHY_API_KEY; 

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

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null); 

  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [brushColor, setBrushColor] = useState("#FF0000"); 
  const [brushSize, setBrushSize] = useState(5); 
  const [brushType, setBrushType] = useState("normal"); 
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const chatAreaRef = useRef(null); 

  const [reactingMsgId, setReactingMsgId] = useState(null);

  const [groups, setGroups] = useState([]);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const [isGifOpen, setIsGifOpen] = useState(false);
  const [gifs, setGifs] = useState([]);
  const [gifSearchTerm, setGifSearchTerm] = useState("");

  const [isFetchingUsers, setIsFetchingUsers] = useState(true); 
  const [isFetchingChat, setIsFetchingChat] = useState(false);  

  // --- 【新增】：控制側邊欄開關的狀態 ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    if (!isDrawingMode && !reactingMsgId) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "chats"), 
      where("type", "==", "group"), 
      where("members", "array-contains", user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupList = [];
      snapshot.forEach(doc => groupList.push({ id: doc.id, ...doc.data() }));
      setGroups(groupList);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!selectedChatId) return;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    setIsFetchingChat(true); 

    const q = query(
      collection(db, "chats", selectedChatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const newMsg = change.doc.data();
          const isMine = newMsg.senderId === auth.currentUser?.uid;
          
          if (!isMine && !document.hasFocus() && Notification.permission === "granted") {
            const senderName = newMsg.senderEmail.split('@')[0];
            new Notification(`NTHU Chat: 新訊息來自 ${senderName}`, {
              body: newMsg.text ? newMsg.text : (newMsg.isCustomSticker ? "傳送了一個手繪貼圖 🎨" : "傳送了一張圖片/GIF 🖼️"),
            });
          }
        }
      });
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsFetchingChat(false); 
    });

    return () => unsubscribe();
  }, [selectedChatId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!editingMsgId && searchTerm === "") {
      scrollToBottom();
    }
  }, [messages, editingMsgId, searchTerm]);

  useEffect(() => {
    if (isDrawingMode && canvasRef.current && chatAreaRef.current) {
      const canvas = canvasRef.current;
      canvas.width = chatAreaRef.current.clientWidth;
      canvas.height = chatAreaRef.current.clientHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height); 
    }
  }, [isDrawingMode]);

  const fetchGifs = async (searchQuery = "") => {
    try {
      let endpoint = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=12&rating=g`;
      if (searchQuery.trim() !== "") {
        endpoint = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchQuery)}&limit=12&rating=g`;
      }
      const res = await fetch(endpoint);
      const data = await res.json();
      setGifs(data.data);
    } catch (error) {
      console.error("抓取 GIF 失敗:", error);
    }
  };

  useEffect(() => {
    if (isGifOpen && gifs.length === 0) {
      fetchGifs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGifOpen, gifs.length]);

  const handleGifSearch = () => {
    fetchGifs(gifSearchTerm);
  };

  const fetchAllUsers = async () => {
    setIsFetchingUsers(true); 
    try {
      const q = query(collection(db, "users"));
      const querySnapshot = await getDocs(q);
      const usersList = [];
      querySnapshot.forEach((doc) => {
        if (doc.id !== auth.currentUser.uid) {
          usersList.push({ id: doc.id, ...doc.data() });
        }
      });
      setUsers(usersList);
    } finally {
      setIsFetchingUsers(false); 
    }
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
    setSelectedChatUser({ ...targetUser, isGroup: false }); 
    cancelEdit(); 
    setSearchTerm(""); 
    setIsSearchOpen(false);
    setIsDrawingMode(false); 
    setReactingMsgId(null);
    setIsInviteOpen(false);
    setIsGifOpen(false); 
    
    // 【新增】：在手機版點選好友後，自動收起側邊欄
    setIsSidebarOpen(false);
  };

  const startGroupChat = (group) => {
    setSelectedChatId(group.id);
    setSelectedChatUser({ uid: group.id, displayName: group.name || "群組聊天", isGroup: true, members: group.members });
    cancelEdit();
    setSearchTerm("");
    setIsSearchOpen(false);
    setIsDrawingMode(false);
    setReactingMsgId(null);
    setIsInviteOpen(false);
    setIsGifOpen(false);
    
    // 【新增】：在手機版點選群組後，自動收起側邊欄
    setIsSidebarOpen(false);
  };

  const handleInvite = async (userToInvite) => {
    try {
      if (selectedChatUser.isGroup) {
        await updateDoc(doc(db, "chats", selectedChatId), {
          members: arrayUnion(userToInvite.uid)
        });
        setSelectedChatUser({
           ...selectedChatUser, 
           members: [...selectedChatUser.members, userToInvite.uid]
        });
        alert(`已將 ${userToInvite.displayName || userToInvite.email.split('@')[0]} 加入群組！`);
      } else {
        const newGroupName = `${currentUserData?.displayName || "我"}, ${selectedChatUser?.displayName || selectedChatUser?.email.split('@')[0]}, ${userToInvite.displayName || userToInvite.email.split('@')[0]}`;
        
        const newGroupRef = await addDoc(collection(db, "chats"), {
          type: "group",
          name: newGroupName,
          members: [auth.currentUser.uid, selectedChatUser.uid, userToInvite.uid],
          createdAt: serverTimestamp()
        });
        
        setSelectedChatId(newGroupRef.id);
        setSelectedChatUser({
          uid: newGroupRef.id,
          displayName: newGroupName,
          isGroup: true,
          members: [auth.currentUser.uid, selectedChatUser.uid, userToInvite.uid]
        });
        alert("已為您建立新群組！");
      }
      setIsInviteOpen(false); 
    } catch (error) {
      alert("邀請失敗：" + error.message);
    }
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
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
      alert("訊息操作失敗，請檢查網路連線！");
      setNewMessage(textToSend); 
    }
  };

  const sendGif = async (gifUrl) => {
    if (!selectedChatId) return;
    setIsUploading(true);
    try {
      await addDoc(collection(db, "chats", selectedChatId, "messages"), {
        text: "", 
        imageUrl: gifUrl, 
        senderId: auth.currentUser.uid,
        senderEmail: auth.currentUser.email,
        createdAt: serverTimestamp(),
        isEdited: false 
      });
      setIsGifOpen(false); 
      setGifSearchTerm(""); 
    } catch (error) {
      alert("GIF 傳送失敗：" + error.message);
    } finally {
      setIsUploading(false);
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

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = brushColor;
    ctx.fillStyle = brushColor; 
    ctx.lineWidth = brushSize;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;    

    if (brushType === 'glow') {
      ctx.shadowBlur = 15;   
      ctx.shadowColor = brushColor;
    }

    if (brushType !== 'spray') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (brushType === 'spray') {
      const density = brushSize * 4; 
      const sprayRadius = brushSize * 1.5; 
      
      for (let i = 0; i < density; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * sprayRadius;
        const dotX = x + Math.cos(angle) * radius;
        const dotY = y + Math.sin(angle) * radius;
        ctx.fillRect(dotX, dotY, 1.5, 1.5); 
      }
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (brushType !== 'spray') {
        ctx.closePath();
      }
      setIsDrawing(false);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const sendCustomSticker = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedChatId) return;

    const ctx = canvas.getContext('2d');
    const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
    const hasContent = pixelBuffer.some(color => color !== 0);
    
    if (!hasContent) {
      alert("請先畫點東西再傳送喔！");
      return;
    }

    setIsUploading(true);
    const stickerDataUrl = canvas.toDataURL("image/png");

    try {
      await addDoc(collection(db, "chats", selectedChatId, "messages"), {
        text: "", 
        imageUrl: stickerDataUrl, 
        isCustomSticker: true, 
        senderId: auth.currentUser.uid,
        senderEmail: auth.currentUser.email,
        createdAt: serverTimestamp(),
        isEdited: false 
      });
      setIsDrawingMode(false); 
      clearCanvas();
    } catch (error) {
      alert("手繪貼圖傳送失敗：" + error.message);
    } finally {
      setIsUploading(false);
    }
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

  const toggleReaction = async (msg, emoji) => {
    if (!selectedChatId) return;
    
    const userId = auth.currentUser.uid;
    const currentReactions = msg.reactions || {};
    const newReactions = { ...currentReactions };

    if (newReactions[userId] === emoji) {
      delete newReactions[userId];
    } else {
      newReactions[userId] = emoji; 
    }

    try {
      await updateDoc(doc(db, "chats", selectedChatId, "messages", msg.id), {
        reactions: newReactions
      });
    } catch (error) {
      console.error("更新表情失敗", error);
    }
    setReactingMsgId(null); 
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
      {/* Profile Modal */}
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
            <div style={{ marginBottom: "12px", textAlign: "left" }}><label style={{ fontSize: "13px", color: "#555", fontWeight: "bold" }}>顯示名稱 (Username)</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "5px", border: "1px solid #ccc" }} placeholder="輸入你的暱稱" /></div>
            <div style={{ marginBottom: "12px", textAlign: "left" }}><label style={{ fontSize: "13px", color: "#555", fontWeight: "bold" }}>電子郵件 (Email)</label><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "5px", border: "1px solid #ccc" }} placeholder="example@gmail.com" /></div>
            <div style={{ marginBottom: "12px", textAlign: "left" }}><label style={{ fontSize: "13px", color: "#555", fontWeight: "bold" }}>電話號碼 (Phone number)</label><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "5px", border: "1px solid #ccc" }} placeholder="0912-345-678" /></div>
            <div style={{ marginBottom: "20px", textAlign: "left" }}><label style={{ fontSize: "13px", color: "#555", fontWeight: "bold" }}>地址 (Address)</label><input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "5px", border: "1px solid #ccc" }} placeholder="輸入你的地址" /></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}><button onClick={() => setIsProfileOpen(false)} style={{ padding: "10px 20px", border: "1px solid #ddd", background: "white", borderRadius: "5px", cursor: "pointer", color: "#555", fontWeight: "bold" }}>取消</button><button onClick={saveProfile} disabled={isUpdatingProfile} style={{ padding: "10px 20px", border: "none", borderRadius: "5px", cursor: "pointer", background: "#06C755", color: "white", fontWeight: "bold" }}>{isUpdatingProfile ? "儲存中..." : "儲存設定"}</button></div>
          </div>
        </div>
      )}

      {/* 【新增】：點擊會關閉側邊欄的防呆遮罩 */}
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>

      {/* --- 側邊欄 (加上 isSidebarOpen 判斷 CSS 狀態) --- */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>好友與群組</span>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="logout-btn" onClick={() => setIsProfileOpen(true)} title="個人資料設定">⚙️</button>
            <button className="logout-btn" onClick={handleLogout}>登出</button>
          </div>
        </div>
        
        <div style={{ padding: "8px 15px", background: "#f9f9f9", fontSize: "12px", fontWeight: "bold", color: "#666" }}>好友私訊</div>
        <div className="user-list" style={{ flex: "none", maxHeight: "40vh", overflowY: "auto" }}>
          {isFetchingUsers ? (
             <div className="loader-container"><div className="spinner"></div></div>
          ) : (
            users.map(u => (
              <div key={u.uid} className={`user-item ${selectedChatId === [auth.currentUser.uid, u.uid].sort().join("_") ? 'active' : ''}`} onClick={() => startChat(u)}>
                {u.photoURL ? (
                  <img src={u.photoURL} alt="avatar" className="user-avatar" style={{ objectFit: "cover", padding: 0 }} />
                ) : (
                  <div className="user-avatar">{u.email.charAt(0).toUpperCase()}</div>
                )}
                <div>{u.displayName || u.email.split('@')[0]}</div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: "8px 15px", background: "#f9f9f9", fontSize: "12px", fontWeight: "bold", color: "#666", borderTop: "1px solid #eee" }}>我的群組</div>
        <div className="user-list" style={{ flex: 1 }}>
          {groups.map(g => (
            <div key={g.id} className={`user-item ${selectedChatId === g.id ? 'active' : ''}`} onClick={() => startGroupChat(g)}>
              <div className="user-avatar" style={{ backgroundColor: "#06C755" }}>👥</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-area">
        {selectedChatId ? (
          <>
            <div className="chat-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                 {/* 【新增】：手機版專用的返回按鈕 */}
                 <button className="mobile-only" onClick={() => { setSelectedChatId(null); setIsSidebarOpen(true); }} style={{ background: "transparent", border: "none", fontSize: "28px", cursor: "pointer", padding: "0 10px 0 0", color: "#555" }}>‹</button>
                 <span>{selectedChatUser?.displayName || selectedChatUser?.email?.split('@')[0]}</span>
              </div>
              
              <div style={{ display: "flex", gap: "10px", position: "relative" }}>
                <button 
                  onClick={() => setIsInviteOpen(!isInviteOpen)} 
                  style={{ background: isInviteOpen ? "#e0e0e0" : "transparent", border: "none", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center" }} 
                  title="邀請成員"
                >
                  ➕
                </button>

                {isInviteOpen && (
                  <div style={{ position: "absolute", top: "40px", right: "0", background: "white", width: "220px", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 100, border: "1px solid #ddd", padding: "10px" }}>
                    <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#333", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>選擇好友加入聊天</h4>
                    <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                      {users.filter(u => {
                        const currentMembers = selectedChatUser?.isGroup ? selectedChatUser.members : [auth.currentUser.uid, selectedChatUser?.uid];
                        return !currentMembers.includes(u.uid);
                      }).length === 0 ? (
                        <div style={{ fontSize: "12px", color: "#999", textAlign: "center", padding: "10px 0" }}>好友皆已在群組中</div>
                      ) : (
                        users.filter(u => {
                          const currentMembers = selectedChatUser?.isGroup ? selectedChatUser.members : [auth.currentUser.uid, selectedChatUser?.uid];
                          return !currentMembers.includes(u.uid);
                        }).map(u => (
                          <div key={u.uid} onClick={() => handleInvite(u)} style={{ padding: "8px", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", borderRadius: "5px", transition: "background 0.2s" }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f5f9f5"} onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
                            {u.photoURL ? (
                              <img src={u.photoURL} alt="avatar" style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "#ccc", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "12px" }}>
                                {u.email.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span style={{ fontSize: "13px", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{u.displayName || u.email.split('@')[0]}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
                <button onClick={toggleSearch} style={{ background: isSearchOpen ? "#e0e0e0" : "transparent", border: "none", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center" }} title="搜尋訊息">🔍</button>
              </div>
            </div>

            {isSearchOpen && (
              <div style={{ padding: "10px 20px", backgroundColor: "#ffffff", borderBottom: "1px solid #e0e0e0" }}>
                <input type="text" placeholder="🔍 搜尋此聊天室的訊息..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus style={{ width: "100%", padding: "8px 15px", borderRadius: "20px", border: "1px solid #ddd", outline: "none", fontSize: "14px", backgroundColor: "#f9f9f9" }} />
              </div>
            )}
            
            <div ref={chatAreaRef} style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              
              <div className="messages-container" style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                {isFetchingChat ? (
                   <div className="loader-container"><div className="spinner"></div></div>
                ) : (
                  <>
                    {filteredMessages.map(m => {
                      const isMine = m.senderId === auth.currentUser.uid;
                      const isEditingThis = editingMsgId === m.id;
                      
                      const senderInfo = isMine ? currentUserData : users.find(u => u.uid === m.senderId);
                      const displayName = senderInfo?.displayName || m.senderEmail.split('@')[0];
                      const avatar = senderInfo?.photoURL;

                      const reactionCounts = {};
                      if (m.reactions) {
                        Object.values(m.reactions).forEach(emoji => {
                          reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
                        });
                      }

                      return (
                        <div key={m.id} className={`message-wrapper ${isMine ? 'mine' : 'other'}`} style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', maxWidth: '100%', marginBottom: "15px" }}>
                          
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

                          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: m.isCustomSticker ? '100%' : '70%', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                            <div className="message-sender" style={{ marginLeft: 0, marginRight: 0 }}>{displayName}</div>
                            
                            <div style={{ display: "flex", alignItems: "flex-end", gap: "5px", flexDirection: isMine ? "row-reverse" : "row" }}>
                              
                              {m.isCustomSticker ? (
                                 <div style={{ position: "relative" }}>
                                   <img src={m.imageUrl} alt="custom-sticker" style={{ width: "100%", maxHeight: "400px", objectFit: "contain", display: "block", pointerEvents: "none" }} />
                                 </div>
                              ) : (
                                <div className="message-bubble" style={{ opacity: isEditingThis ? 0.5 : 1, padding: m.imageUrl ? "5px" : "10px 15px", backgroundColor: m.imageUrl ? "transparent" : "" }}>
                                  {m.imageUrl ? (
                                    <img src={m.imageUrl} alt="chat-img" style={{ maxWidth: "200px", borderRadius: "10px", display: "block" }} />
                                  ) : (
                                    m.text
                                  )}
                                  {m.isEdited && !m.imageUrl && <span style={{ fontSize: "10px", color: isMine ? "#444" : "#999", marginLeft: "6px" }}>(已編輯)</span>}
                                </div>
                              )}

                              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                <button onClick={() => setReactingMsgId(reactingMsgId === m.id ? null : m.id)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "14px", opacity: 0.6, padding: 0 }} title="加入表情">😀</button>
                                {reactingMsgId === m.id && (
                                  <div style={{ position: "absolute", bottom: "100%", left: isMine ? "auto" : "0", right: isMine ? "0" : "auto", background: "white", padding: "5px 10px", borderRadius: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.15)", display: "flex", gap: "8px", zIndex: 100 }}>
                                    {EMOJI_OPTIONS.map(emoji => (
                                      <span key={emoji} onClick={() => toggleReaction(m, emoji)} style={{ cursor: "pointer", fontSize: "18px", transition: "transform 0.1s" }} onMouseOver={(e) => e.target.style.transform="scale(1.3)"} onMouseOut={(e) => e.target.style.transform="scale(1)"}>{emoji}</span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {isMine && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                  <button onClick={() => handleUnsend(m.id)} style={{ border: "none", background: "transparent", color: "#ff4d4f", fontSize: "12px", cursor: "pointer", padding: "0" }}>收回</button>
                                  {!m.imageUrl && !m.isCustomSticker && (
                                    <button onClick={() => startEdit(m)} style={{ border: "none", background: "transparent", color: "#666", fontSize: "12px", cursor: "pointer", padding: "0" }}>編輯</button>
                                  )}
                                </div>
                              )}
                            </div>

                            {Object.keys(reactionCounts).length > 0 && (
                              <div style={{ display: "flex", gap: "5px", marginTop: "4px", alignSelf: isMine ? "flex-end" : "flex-start" }}>
                                {Object.entries(reactionCounts).map(([emoji, count]) => (
                                  <div key={emoji} onClick={() => toggleReaction(m, emoji)} style={{ background: "rgba(255,255,255,0.9)", border: "1px solid #ddd", padding: "2px 6px", borderRadius: "12px", fontSize: "12px", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                                    {emoji} <span style={{ color: "#666", fontWeight: "bold" }}>{count}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                          </div>
                        </div>
                      );
                    })}
                    {searchTerm && filteredMessages.length === 0 && (
                      <div style={{ textAlign: "center", color: "#666", marginTop: "20px" }}>找不到包含「{searchTerm}」的訊息</div>
                    )}
                    <div ref={messagesEndRef} /> 
                  </>
                )}
              </div>

              {isDrawingMode && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: "rgba(255, 255, 255, 0.8)", cursor: "crosshair" }}>
                   <div style={{ position: "absolute", top: "10px", left: "50%", transform: "translateX(-50%)", background: "white", padding: "10px 20px", borderRadius: "20px", display: "flex", gap: "15px", alignItems: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 60 }}>
                      <span style={{ fontSize: "14px", fontWeight: "bold", color: "#555" }}>🎨 畫貼圖</span>
                      
                      <select 
                        value={brushType} 
                        onChange={(e) => setBrushType(e.target.value)} 
                        style={{ padding: "4px 8px", borderRadius: "5px", border: "1px solid #ccc", outline: "none", cursor: "pointer" }}
                      >
                        <option value="normal">一般畫筆</option>
                        <option value="spray">噴漆</option>
                        <option value="glow">發光筆</option>
                      </select>

                      <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} style={{ width: "30px", height: "30px", border: "none", padding: 0, cursor: "pointer" }} />
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ fontSize: "12px", color: "#666" }}>粗細:</span>
                        <input type="range" min="1" max="20" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} style={{ width: "80px" }} />
                      </div>
                      <div style={{ width: "1px", height: "20px", background: "#ddd", margin: "0 5px" }}></div>
                      <button onClick={clearCanvas} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ff4d4f", fontSize: "14px", fontWeight: "bold" }}>清除</button>
                      <button onClick={() => setIsDrawingMode(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#666", fontSize: "14px" }}>取消</button>
                      <button onClick={sendCustomSticker} disabled={isUploading} style={{ background: "#06C755", color: "white", border: "none", padding: "5px 15px", borderRadius: "15px", cursor: "pointer", fontWeight: "bold" }}>
                        {isUploading ? "傳送中..." : "送出"}
                      </button>
                   </div>
                   <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} style={{ display: "block" }} />
                </div>
              )}
            </div>

            <form className="input-area" onSubmit={sendMessage} style={{ alignItems: "center", position: "relative", zIndex: 60 }}>
              
              <div style={{ position: "relative" }}>
                <button 
                  type="button" 
                  onClick={() => setIsGifOpen(!isGifOpen)} 
                  style={{ background: isGifOpen ? "#e0e0e0" : "transparent", border: "none", fontSize: "20px", cursor: "pointer", padding: "0 10px", borderRadius: "50%" }} 
                  title="傳送 GIF"
                >
                  🎬
                </button>

                {isGifOpen && (
                  <div style={{ position: "absolute", bottom: "40px", left: "0", background: "white", padding: "10px", borderRadius: "10px", boxShadow: "0 -4px 12px rgba(0,0,0,0.15)", width: "300px", zIndex: 100 }}>
                    <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333", borderBottom: "1px solid #eee", paddingBottom: "5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>{gifSearchTerm ? "搜尋結果" : "熱門 GIF"}</span>
                      <span onClick={() => setIsGifOpen(false)} style={{ cursor: "pointer", color: "#999", fontSize: "16px" }}>✖</span>
                    </h4>
                    
                    <div style={{ display: "flex", gap: "5px", marginBottom: "10px" }}>
                      <input
                        type="text"
                        placeholder="搜尋動圖..."
                        value={gifSearchTerm}
                        onChange={(e) => setGifSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                             e.preventDefault(); 
                             handleGifSearch();
                          }
                        }}
                        style={{ flex: 1, padding: "5px 8px", borderRadius: "15px", border: "1px solid #ccc", outline: "none", fontSize: "12px" }}
                      />
                      <button 
                        type="button" 
                        onClick={handleGifSearch} 
                        style={{ background: "#06C755", color: "white", border: "none", padding: "5px 10px", borderRadius: "15px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}
                      >
                        搜尋
                      </button>
                    </div>

                    {gifs.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "20px", color: "#999", fontSize: "12px" }}>載入中或找不到結果...</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", maxHeight: "250px", overflowY: "auto" }}>
                        {gifs.map(gif => (
                          <img
                            key={gif.id}
                            src={gif.images.fixed_height_small.url} 
                            alt={gif.title}
                            onClick={() => sendGif(gif.images.fixed_width.url)} 
                            style={{ width: "100%", height: "80px", objectFit: "cover", cursor: "pointer", borderRadius: "5px" }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button type="button" onClick={() => setIsDrawingMode(!isDrawingMode)} style={{ background: isDrawingMode ? "#e0e0e0" : "transparent", border: "none", fontSize: "20px", cursor: "pointer", padding: "0 10px", borderRadius: "50%" }} title="手繪貼圖">🖌️</button>
              <input type="file" accept="image/*" id="image-upload" style={{ display: "none" }} onChange={handleImageUpload} />
              <button type="button" onClick={() => document.getElementById('image-upload').click()} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", padding: "0 10px", opacity: (isSearchOpen || isUploading || isDrawingMode) ? 0.5 : 1 }} disabled={isSearchOpen || isUploading || isDrawingMode} title="傳送圖片">
                {isUploading ? "⏳" : "🖼️"}
              </button>
              <input className="chat-input" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={editingMsgId ? "修改訊息..." : (isDrawingMode ? "正在畫圖中..." : "輸入訊息...")} disabled={isSearchOpen || isUploading || isDrawingMode} />
              <button type="submit" className="send-btn" disabled={!newMessage.trim() || isSearchOpen || isUploading || isDrawingMode}>
                {editingMsgId ? "儲存" : "傳送"}
              </button>
            </form>
          </>
        ) : (
          <div className="empty-chat" style={{ position: "relative" }}>
            {/* 【新增】：在尚未選擇聊天對象的空白畫面時，也提供漢堡選單 */}
            <button className="mobile-only" onClick={() => setIsSidebarOpen(true)} style={{ position: "absolute", top: "20px", left: "20px", background: "transparent", border: "none", fontSize: "28px", cursor: "pointer", color: "#666" }}>☰</button>
            請選擇左側的好友開始聊天
          </div>
        )}
      </div>
    </div>
  );
}

export default App;