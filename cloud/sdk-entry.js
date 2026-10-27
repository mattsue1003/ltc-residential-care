// 打包成單一本機檔，不從外部 CDN 載入程式碼
export { initializeApp } from 'firebase/app';
export { getAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, setPersistence,
  browserSessionPersistence, multiFactor, TotpMultiFactorGenerator, TotpSecret, getMultiFactorResolver, sendPasswordResetEmail,
  verifyPasswordResetCode, confirmPasswordReset, updatePassword } from 'firebase/auth';
export { initializeFirestore, memoryLocalCache, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where,
  getDocs, onSnapshot, serverTimestamp, writeBatch, Timestamp, orderBy, limit } from 'firebase/firestore';
export { getStorage, connectStorageEmulator, ref, uploadString, getBytes, deleteObject } from 'firebase/storage';
import qrcode from 'qrcode-generator';
export { qrcode };
