// src/App.js
import React, { useState, useEffect } from 'react';
import { auth, provider, db } from './firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, where, getDocs } from 'firebase/firestore';

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  
  // 聊天室相關狀態
  const [users, setUsers] = useState([]); // 儲存所有使用者
  const [selectedChatId, setSelectedChatId] = useState(null); // 當前選中的聊天室 ID
  const [messages, setMessages] = useState([]); // 當前聊天室的訊息
  const [newMessage, setNewMessage] = useState(""); // 輸入框文字

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchAllUsers(); // 登入後抓取所有使用者清單
      }
    });
    return () => unsubscribe();
  }, []);

  // 監聽當前選中聊天室的訊息變化 (即時更新)
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

  // 抓取所有註冊使用者 (除了自己)
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

  // 建立或進入與特定對象的聊天室
  const startChat = async (targetUser) => {
    // 簡單邏輯：使用雙方 UID 組合來當 ID，確保唯一性
    const chatId = [auth.currentUser.uid, targetUser.uid].sort().join("_");
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      // 如果聊天室不存在，建立新房間
      await setDoc(chatRef, {
        members: [auth.currentUser.uid, targetUser.uid],
        createdAt: serverTimestamp(),
        type: "private" // 標記為私人聊天 
      });
    }
    setSelectedChatId(chatId);
  };

  // 發送訊息
  const sendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !selectedChatId) return;

    await addDoc(collection(db, "chats", selectedChatId, "messages"), {
      text: newMessage,
      senderId: auth.currentUser.uid,
      senderEmail: auth.currentUser.email,
      createdAt: serverTimestamp()
    });
    setNewMessage("");
  };

  // --- 以下為原本的 Auth 邏輯 (省略 handleLogin, handleRegister, handleGoogleLogin, handleLogout 以節省空間，請保留你原本的實作) ---
  const handleRegister = async () => { try { const res = await createUserWithEmailAndPassword(auth, email, password); await saveUserToFirestore(res.user); } catch (e) { alert(e.message); } };
  const handleLogin = async () => { try { await signInWithEmailAndPassword(auth, email, password); } catch (e) { alert(e.message); } };
  const handleGoogleLogin = async () => { try { const res = await signInWithPopup(auth, provider); await saveUserToFirestore(res.user); } catch (e) { alert(e.message); } };
  const handleLogout = async () => { await signOut(auth); setSelectedChatId(null); };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", display: "flex", gap: "20px" }}>
      {!user ? (
        <div style={{ maxWidth: "400px" }}>
          <h1>NTHU 聊天室</h1>
          <h3>請先登入或註冊</h3>
          <input type="email" placeholder="信箱" value={email} onChange={(e) => setEmail(e.target.value)} /><br /><br />
          <input type="password" placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} /><br /><br />
          <button onClick={handleLogin}>登入</button>
          <button onClick={handleRegister} style={{ marginLeft: "10px" }}>註冊</button>
          <button onClick={handleGoogleLogin} style={{ marginTop: "10px", display: "block" }}>使用 Google 登入</button>
        </div>
      ) : (
        <>
          {/* 左側：使用者清單 */}
          <div style={{ width: "250px", borderRight: "1px solid #ddd", paddingRight: "20px" }}>
            <h3>聯絡人</h3>
            {users.map(u => (
              <div key={u.uid} onClick={() => startChat(u)} style={{ padding: "10px", cursor: "pointer", backgroundColor: selectedChatId?.includes(u.uid) ? "#f0f0f0" : "transparent" }}>
                {u.displayName || u.email}
              </div>
            ))}
            <hr />
            <button onClick={handleLogout}>登出</button>
          </div>

          {/* 右側：對話視窗 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "80vh" }}>
            {selectedChatId ? (
              <>
                <h3>對話中 ({selectedChatId})</h3>
                <div style={{ flex: 1, overflowY: "scroll", border: "1px solid #ddd", padding: "10px", marginBottom: "10px" }}>
                  {messages.map(m => (
                    <div key={m.id} style={{ textAlign: m.senderId === auth.currentUser.uid ? "right" : "left", margin: "5px 0" }}>
                      <div style={{ fontSize: "12px", color: "#888" }}>{m.senderEmail}</div>
                      <div style={{ display: "inline-block", padding: "8px", borderRadius: "10px", backgroundColor: m.senderId === auth.currentUser.uid ? "#0084ff" : "#eee", color: m.senderId === auth.currentUser.uid ? "white" : "black" }}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendMessage} style={{ display: "flex" }}>
                  <input style={{ flex: 1, padding: "10px" }} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="輸入訊息..." />
                  <button type="submit">發送</button>
                </form>
              </>
            ) : (
              <div style={{ textAlign: "center", marginTop: "100px", color: "#888" }}>點擊左側聯絡人開始聊天</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;