import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, 
  Calendar, 
  MapPin, 
  Music, 
  Pause, 
  Play, 
  Send, 
  Copy, 
  Check, 
  Clock, 
  Users,
  Sparkles,
  Camera,
  Gift,
  Info,
  ChevronRight,
  Share2,
  BookOpen,
  Volume2,
  Shirt,
  PenTool
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  serverTimestamp 
} from 'firebase/firestore';

/**
 * KONFIGURASI & INISIALISASI
 */
const apiKey = ""; // API Key Gemini (Otomatis dari environment)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'wedding-maroon-full-v1';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

// Inisialisasi Firebase (Hanya jika config tersedia)
const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

// --- BAGIAN EDIT ASET ---
const MUSIC_URL = "https://res.cloudinary.com/dgtz4aiww/video/upload/v1777251805/WhatsApp_Audio_2026-04-27_at_8.00.04_AM_fvspdh.mp3";
const HERO_IMG = "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2000&auto=format&fit=crop";
const BRIDE_IMG = "https://res.cloudinary.com/dgtz4aiww/image/upload/v1777257166/WhatsApp_Image_2026-04-27_at_9.32.07_AM_mcnk0u.jpg";
const GROOM_IMG = "https://res.cloudinary.com/dgtz4aiww/image/upload/v1777257166/WhatsApp_Image_2026-04-27_at_9.32.07_AM_1_zwmdmy.jpg";
const QRIS_IMG = "https://res.cloudinary.com/dgtz4aiww/image/upload/v1777282429/WhatsApp_Image_2026-04-27_at_4.30.27_PM_hv46tg.jpg"; 

/**
 * PANGGILAN API GEMINI (Text Generation)
 */
const callGemini = async (prompt, retryCount = 0) => {
  if (!apiKey) return "";
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "Anda adalah asisten pernikahan puitis dan ramah bernama WeddingAI untuk acara Alul & Dewi." }] }
      })
    });

    if (!response.ok && retryCount < 5) {
      const waitTime = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return callGemini(prompt, retryCount + 1);
    }

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    if (retryCount < 5) {
      const waitTime = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return callGemini(prompt, retryCount + 1);
    }
    return "";
  }
};

/**
 * GEMINI TEXT TO SPEECH (TTS)
 */
const playTTS = async (text) => {
  if (!apiKey) return;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Katakan dengan nada hangat dan ramah: ${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
        }
      })
    });

    const result = await response.json();
    const pcmData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!pcmData) return;

    // Convert PCM to WAV
    const binaryString = window.atob(pcmData);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    const sampleRate = 24000; // Default Gemini TTS
    
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + bytes.length, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, bytes.length, true);

    const blob = new Blob([wavHeader, bytes], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  } catch (e) {
    console.error("TTS Error:", e);
  }
};

/**
 * KOMPONEN UTAMA
 */
export default function Page() {
  const [user, setUser] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showInvitation, setShowInvitation] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  const handleOpenInvitation = () => {
    setShowInvitation(true);
    setIsPlaying(true);
    if (audioRef.current) audioRef.current.play();
  };

  const handleVoiceInvite = async () => {
    setIsSpeaking(true);
    await playTTS("Selamat datang di undangan pernikahan Alul dan Dewi. Kami sangat menantikan kehadiran Anda di Kediri pada tanggal lima Juni dua ribu dua puluh enam.");
    setIsSpeaking(false);
  };

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); } 
    else { audioRef.current.play(); }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-[#4A0404] selection:bg-maroon/20 overflow-x-hidden font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Inter:wght@300;400;500&display=swap');
        .font-serif { font-family: 'Cormorant Garamond', serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
        .text-maroon { color: #800000; }
        .bg-maroon { background-color: #800000; }
        .border-maroon { border-color: #800000; }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #800000; border-radius: 10px; }
      `}</style>

      <audio ref={audioRef} src={MUSIC_URL} loop />

      <AnimatePresence>
        {!showInvitation && (
          <motion.div 
            exit={{ y: '-100%' }}
            transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
            className="fixed inset-0 z-[100] bg-[#4A0404] flex flex-col items-center justify-center text-center px-6 text-[#FDFCF8]"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }} className="mb-8">
              <Heart className="w-12 h-12 text-[#D4AF37] fill-[#D4AF37]" />
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="uppercase tracking-[0.4em] text-xs mb-4 opacity-70">Undangan Pernikahan</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="text-5xl md:text-7xl font-serif mb-12">Alul & Dewi</motion.h1>
            
            <div className="flex flex-col gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleOpenInvitation}
                className="px-10 py-4 bg-[#FDFCF8] text-[#4A0404] rounded-full flex items-center gap-3 text-sm tracking-widest uppercase font-bold shadow-2xl hover:bg-[#D4AF37] hover:text-white transition-all"
              >
                Buka Undangan
              </motion.button>
              
              <button 
                onClick={handleVoiceInvite}
                disabled={isSpeaking}
                className="text-xs text-[#D4AF37] flex items-center justify-center gap-2 uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity"
              >
                {isSpeaking ? <Clock size={12} className="animate-spin" /> : <Volume2 size={12} />}
                ✨ Dengarkan Undangan
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showInvitation && (
        <button 
          onClick={toggleMusic}
          className="fixed bottom-6 right-6 z-50 bg-[#800000]/90 backdrop-blur-md p-4 rounded-full shadow-lg text-white transition-all hover:scale-110 active:scale-95"
        >
          {isPlaying ? <Pause size={20} className="animate-pulse" /> : <Play size={20} />}
        </button>
      )}

      <div className={showInvitation ? 'opacity-100' : 'opacity-0'}>
        <HeroSection />
        <CountdownSection />
        <CoupleSection />
        
        {/* NEW ✨: AI DRESS CODE */}
        <AiDressCodeSection />
        
        <GallerySection />
        
        {/* NEW ✨: AI POEM DEDICATION */}
        <AiPoemSection />
        
        <RsvpSection user={user} />
        <AiInteractionSection />
        <GiftSection />
        
        <footer className="py-16 bg-[#4A0404] text-white text-center flex flex-col items-center">
          <Heart className="text-[#D4AF37] mb-6" size={24} fill="currentColor" />
          <p className="font-serif italic text-3xl mb-2">Alul & Dewi</p>
          <div className="w-12 h-[1px] bg-white/20 mb-4" />
          <p className="text-[10px] uppercase tracking-widest opacity-50">Dibuat dengan penuh cinta & kehangatan</p>
        </footer>
      </div>
    </div>
  );
}

/**
 * HERO SECTION
 */
function HeroSection() {
  return (
    <section className="relative h-screen flex items-center justify-center text-center text-white overflow-hidden">
      <div className="absolute inset-0 bg-black/40 z-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#FDFCF8] z-20" />
      <motion.img 
        initial={{ scale: 1.15 }}
        whileInView={{ scale: 1 }}
        transition={{ duration: 15, ease: "linear" }}
        src={HERO_IMG} 
        className="absolute inset-0 w-full h-full object-cover" 
      />
      <div className="relative z-30 px-6">
        <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} className="uppercase tracking-[0.4em] text-xs mb-6 opacity-90">Kami Mengundang Anda</motion.p>
        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-7xl md:text-9xl font-serif mb-6 drop-shadow-xl">Alul & Dewi</motion.h2>
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-lg md:text-2xl font-serif italic opacity-80">5-6 Juni 2026 • Kediri</motion.p>
      </div>
    </section>
  );
}

/**
 * COUNTDOWN SECTION
 */
function CountdownSection() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const target = new Date("2026-06-05T09:00:00").getTime();
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = target - now;
      if (diff < 0) return clearInterval(interval);
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        secs: Math.floor((diff % (1000 * 60)) / 1000)
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const Item = ({ label, value }) => (
    <div className="flex flex-col items-center">
      <span className="text-5xl md:text-7xl font-serif font-light text-[#800000]">{value.toString().padStart(2, '0')}</span>
      <span className="text-[10px] uppercase tracking-[0.2em] text-[#4A0404]/50 mt-2 font-bold">{label}</span>
    </div>
  );

  return (
    <section className="py-24 bg-[#FDFCF8]">
      <div className="max-w-4xl mx-auto flex justify-around px-4 divide-x divide-[#800000]/10">
        <Item label="Hari" value={timeLeft.days} />
        <Item label="Jam" value={timeLeft.hours} />
        <Item label="Menit" value={timeLeft.mins} />
        <Item label="Detik" value={timeLeft.secs} />
      </div>
    </section>
  );
}

/**
 * PROFIL MEMPELAI
 */
function CoupleSection() {
  const [story, setStory] = useState("");
  const [loadingStory, setLoadingStory] = useState(false);

  const generateStory = async () => {
    setLoadingStory(true);
    const prompt = "Buatlah sebuah narasi puitis dan romantis singkat (maksimal 3 kalimat) tentang pasangan 'Alul' dan 'Dewi' yang melambangkan kesetiaan dan keindahan cinta. Gunakan bahasa Indonesia yang sangat elegan.";
    const result = await callGemini(prompt);
    setStory(result);
    setLoadingStory(false);
  };

  return (
    <section className="py-32 px-6 bg-white overflow-hidden">
      <div className="max-w-5xl mx-auto text-center mb-20">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="h-[1px] w-12 bg-maroon/20" />
          <h2 className="text-4xl md:text-5xl font-serif italic text-maroon">Mempelai</h2>
          <div className="h-[1px] w-12 bg-maroon/20" />
        </div>
        
        <div className="mt-8 max-w-lg mx-auto">
          <button 
            onClick={generateStory}
            disabled={loadingStory}
            className="flex items-center gap-2 mx-auto text-xs uppercase tracking-widest text-maroon font-bold hover:opacity-70 transition-all border-b border-maroon/20 pb-1"
          >
            {loadingStory ? <Clock size={14} className="animate-spin" /> : <BookOpen size={14} />}
            ✨ Kisah Cinta Kami
          </button>
          <AnimatePresence>
            {story && (
              <motion.p 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 text-stone-500 font-serif italic text-lg leading-relaxed px-4"
              >
                {story}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-24 items-center">
        {/* Mempelai Pria */}
        <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} className="flex flex-col items-center md:items-end text-center md:text-right">
          <div className="relative mb-10">
            <div className="absolute -inset-4 border-2 border-maroon/10 rounded-full animate-spin-slow" />
            <img src={GROOM_IMG} className="w-64 h-64 md:w-80 md:h-80 object-cover rounded-full border-4 border-white shadow-2xl grayscale hover:grayscale-0 transition-all duration-700" alt="Groom" />
            <div className="absolute -bottom-4 -right-4 bg-maroon text-white p-4 rounded-full shadow-lg">
              <Heart size={24} fill="currentColor" />
            </div>
          </div>
          <h3 className="text-4xl font-serif text-[#4A0404] mb-3">Ahmad Muhlison Jallaludin</h3>
          <p className="text-stone-500 font-sans text-sm mb-4">Putra dari Bapak Eko Santoso & Ibu Siti Uswatun Hasanah Kh</p>
        </motion.div>

        {/* Mempelai Wanita */}
        <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} className="flex flex-col items-center md:items-start text-center md:text-left">
          <div className="relative mb-10">
            <div className="absolute -inset-4 border-2 border-maroon/10 rounded-full animate-spin-slow-reverse" />
            <img src={BRIDE_IMG} className="w-64 h-64 md:w-80 md:h-80 object-cover rounded-full border-4 border-white shadow-2xl grayscale hover:grayscale-0 transition-all duration-700" alt="Bride" />
            <div className="absolute -bottom-4 -left-4 bg-maroon text-white p-4 rounded-full shadow-lg">
              <Heart size={24} fill="currentColor" />
            </div>
          </div>
          <h3 className="text-4xl font-serif text-[#4A0404] mb-3">Dewi Sartika Sari</h3>
          <p className="text-stone-500 font-sans text-sm mb-4">Putri dari Bapak Djuwari & Ibu Saroh</p>
        </motion.div>
      </div>
    </section>
  );
}

/**
 * ✨ FITUR AI: KONSULTAN BUSANA
 */
function AiDressCodeSection() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const askAi = async () => {
    if (!question) return;
    setLoading(true);
    const prompt = `Seorang tamu bertanya: "${question}". Berikan saran pakaian (Dress Code) yang cocok untuk menghadiri pernikahan tema Maroon (Alul & Dewi). Pastikan saran tetap elegan, sopan, dan sesuai untuk acara di Kediri. Balas dengan nada ramah dan puitis.`;
    const result = await callGemini(prompt);
    setAnswer(result);
    setLoading(true);
    setLoading(false);
  };

  return (
    <section className="py-24 bg-stone-50 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <Shirt className="mx-auto text-maroon mb-6" size={28} />
        <h2 className="text-3xl font-serif italic text-maroon mb-4">Saran Busana</h2>
        <p className="text-stone-500 text-sm mb-10">Bingung ingin memakai pakaian apa? Tanyakan pada asisten AI kami.</p>
        
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-maroon/5">
          <div className="flex flex-col gap-4">
            <input 
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full bg-stone-50 border border-maroon/10 rounded-xl px-6 py-4 outline-none focus:border-maroon transition-all text-sm"
              placeholder="Contoh: Apakah batik cokelat cocok dengan tema maroon?"
            />
            <button 
              onClick={askAi}
              disabled={loading || !question}
              className="bg-maroon text-white py-4 rounded-xl text-xs uppercase tracking-widest font-bold shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? <Clock size={16} className="animate-spin" /> : <Sparkles size={16} />}
              ✨ Tanya Konsultan AI
            </button>
          </div>
          
          <AnimatePresence>
            {answer && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-8 text-left p-6 bg-maroon/5 rounded-2xl border-l-4 border-maroon"
              >
                <p className="text-stone-600 text-sm italic leading-relaxed">{answer}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/**
 * GALERI
 */
function GallerySection() {
  const images = [
    "https://res.cloudinary.com/dgtz4aiww/image/upload/v1777251089/WhatsApp_Image_2026-04-27_at_7.48.56_AM_qu0oxl.jpg",
    "https://res.cloudinary.com/dgtz4aiww/image/upload/v1777250077/foto_2_ruspa0.jpg",
    "https://res.cloudinary.com/dgtz4aiww/image/upload/v1777250076/foto_3_agpbet.jpg",
    "https://res.cloudinary.com/dgtz4aiww/image/upload/v1777250076/foto_4_y8nhqq.jpg",
    "https://res.cloudinary.com/dgtz4aiww/image/upload/v1777250077/foto_5_txn4xq.jpg",
    "https://res.cloudinary.com/dgtz4aiww/image/upload/v1777250079/foto_6_vnfirx.jpg",
    "https://res.cloudinary.com/dgtz4aiww/image/upload/v1777250080/foto_7_petuto.jpg",
    "https://res.cloudinary.com/dgtz4aiww/image/upload/v1777250078/foto_8_rexfc4.jpg",
  ];

  return (
    <section className="py-32 bg-[#FDFCF8] px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <Camera className="mx-auto text-maroon opacity-20 mb-6" size={32} />
          <h2 className="text-4xl font-serif italic text-maroon mb-2">Galeri Momen</h2>
          <div className="w-12 h-[1px] bg-maroon/10 mx-auto" />
        </div>
        
        <div className="columns-2 md:columns-3 gap-6 space-y-6">
          {images.map((src, i) => (
            <motion.div key={i} whileHover={{ scale: 0.98 }} className="overflow-hidden rounded-2xl border-4 border-white shadow-xl">
              <img src={src} className="w-full h-auto" alt={`Momen ${i}`} loading="lazy" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * ✨ FITUR AI: DEDIKASI PUISI
 */
function AiPoemSection() {
  const [guest, setGuest] = useState("");
  const [poem, setPoem] = useState("");
  const [loading, setLoading] = useState(false);

  const createPoem = async () => {
    if (!guest) return;
    setLoading(true);
    const prompt = `Buatlah sebuah puisi cinta romantis pendek (4-6 baris) yang didedikasikan untuk pernikahan Alul & Dewi. Puisi ini dibuat dari sudut pandang tamu bernama "${guest}". Gunakan kata-kata yang sangat indah dan puitis dalam Bahasa Indonesia.`;
    const result = await callGemini(prompt);
    setPoem(result);
    setLoading(false);
  };

  return (
    <section className="py-24 bg-maroon text-[#FDFCF8] px-6">
      <div className="max-w-3xl mx-auto text-center">
        <PenTool className="mx-auto text-[#D4AF37] mb-6" size={28} />
        <h2 className="text-3xl font-serif italic mb-4">Dedikasi Puisi</h2>
        <p className="text-white/70 text-sm mb-10">Ciptakan puisi puitis dari Anda untuk kedua mempelai menggunakan AI.</p>
        
        <div className="flex flex-col gap-4 max-w-sm mx-auto mb-8">
          <input 
            value={guest}
            onChange={(e) => setGuest(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-full px-6 py-3 outline-none focus:border-[#D4AF37] transition-all text-sm text-white placeholder:text-white/30"
            placeholder="Masukkan nama Anda..."
          />
          <button 
            onClick={createPoem}
            disabled={loading || !guest}
            className="w-full bg-[#D4AF37] text-maroon py-3 rounded-full text-xs uppercase tracking-widest font-bold shadow-lg hover:bg-white transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Clock size={16} className="animate-spin" /> : <Sparkles size={16} />}
            ✨ Buat Puisi Kustom
          </button>
        </div>

        <AnimatePresence>
          {poem && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }}
              className="mt-8 p-10 bg-white/5 rounded-[2rem] border border-white/10 backdrop-blur-sm"
            >
              <p className="font-serif italic text-xl leading-loose whitespace-pre-wrap">{poem}</p>
              <p className="mt-6 text-[10px] uppercase tracking-[0.3em] opacity-40">— Didedikasikan oleh {guest}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

/**
 * RSVP & UCAPAN
 */
function RsvpSection({ user }) {
  const [name, setName] = useState('');
  const [wish, setWish] = useState('');
  const [isFormatting, setIsFormatting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wishes, setWishes] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user || !db) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'wishes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWishes(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    }, (error) => console.error("Firebase Error:", error));
    return () => unsubscribe();
  }, [user]);

  const handleAI = async () => {
    if (!wish || wish.length < 5) return;
    setIsFormatting(true);
    const polished = await callGemini(`Rapikan ucapan selamat pernikahan ini agar terdengar sangat puitis, hangat, elegan, dan tulus dalam bahasa Indonesia yang indah. Tetap jaga makna aslinya namun buat lebih berkesan. Jangan berikan teks pembuka, langsung saja hasil ucapannya. Teks: "${wish}"`);
    setWish(polished);
    setIsFormatting(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!user || !name || !wish || !db) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'wishes'), {
        name, wish, createdAt: serverTimestamp()
      });
      setName(''); setWish('');
      setMsg('Terima kasih atas ucapannya!');
      setTimeout(() => setMsg(''), 5000);
    } catch (err) { setMsg('Gagal mengirim, coba lagi.'); }
    setIsSubmitting(false);
  };

  return (
    <section className="py-32 bg-stone-100 px-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20">
        <div>
          <h2 className="text-4xl font-serif italic text-maroon mb-8">RSVP & Ucapan</h2>
          <form onSubmit={submit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-maroon/50 font-bold">Nama Tamu</label>
              <input required value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-white border border-maroon/5 rounded-xl px-5 py-4 focus:ring-2 focus:ring-maroon/10 outline-none transition-all text-sm"
                placeholder="Nama lengkap Anda..." />
            </div>
            <div className="space-y-2 relative">
              <label className="text-[10px] uppercase tracking-widest text-maroon/50 font-bold">Harapan & Doa</label>
              <textarea required value={wish} onChange={e => setWish(e.target.value)} rows={5}
                className="w-full bg-white border border-maroon/5 rounded-xl px-5 py-4 focus:ring-2 focus:ring-maroon/10 outline-none transition-all text-sm resize-none"
                placeholder="Tuliskan pesan..." />
              <button type="button" onClick={handleAI} disabled={isFormatting || wish.length < 5}
                className="absolute bottom-4 right-4 p-3 bg-maroon text-white rounded-full hover:scale-105 active:scale-95 disabled:opacity-30 shadow-xl flex items-center gap-3 text-[10px] pl-4 uppercase font-bold tracking-widest">
                {isFormatting ? <Clock size={14} className="animate-spin" /> : <Sparkles size={14} />} ✨ AI MAGIC
              </button>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-maroon text-white py-5 rounded-xl text-[11px] uppercase tracking-[0.2em] font-bold shadow-xl hover:bg-[#4A0404] transition-all">
              {isSubmitting ? "Mengirim..." : "Kirim Ucapan"}
            </button>
            {msg && <p className="text-center text-xs text-maroon italic font-medium">{msg}</p>}
          </form>
        </div>

        <div className="h-[600px] flex flex-col">
          <h3 className="text-xs uppercase tracking-[0.3em] text-maroon font-bold mb-8 flex items-center gap-4">
            Wishlist <div className="flex-1 h-[1px] bg-maroon/10" />
          </h3>
          <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar">
            <AnimatePresence initial={false}>
              {wishes.map((item) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-7 rounded-2xl shadow-sm border border-maroon/5 hover:border-maroon/20 transition-all">
                  <p className="font-serif italic text-maroon/80 text-lg mb-4 leading-relaxed">"{item.wish}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-maroon/5 flex items-center justify-center text-[11px] text-maroon font-bold uppercase">{item.name.charAt(0)}</div>
                    <span className="text-[10px] uppercase tracking-widest text-maroon/40 font-bold">{item.name}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {wishes.length === 0 && <div className="text-center py-20 text-maroon/20 italic">Belum ada ucapan...</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * GENERATOR PESAN BAGIKAN
 */
function AiInteractionSection() {
  const [guestName, setGuestName] = useState("");
  const [inviteText, setInviteText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateInvite = async () => {
    if (!guestName) return;
    setIsGenerating(true);
    const prompt = `Buatlah sebuah pesan undangan personal (puitis dan hangat) yang bisa dibagikan tamu bernama "${guestName}" ke WhatsApp-nya untuk mengumumkan bahwa dia akan hadir di pernikahan 'Alul & Dewi' pada 5 Juni 2026. Gunakan emoji yang manis.`;
    const result = await callGemini(prompt);
    setInviteText(result);
    setIsGenerating(false);
  };

  const copyToClipboard = () => {
    if (inviteText) {
      document.execCommand('copy');
    }
  };

  return (
    <section className="py-24 bg-[#FDFCF8] px-6 border-y border-maroon/5">
      <div className="max-w-2xl mx-auto text-center">
        <Share2 className="mx-auto text-maroon mb-6" size={28} />
        <h2 className="text-3xl font-serif italic text-maroon mb-4">Bagikan Kebahagiaan</h2>
        <p className="text-stone-500 text-sm mb-10 leading-relaxed">Masukkan nama Anda untuk membuat pesan ajakan puitis yang bisa Anda bagikan ke kerabat atau sosial media.</p>
        
        <div className="flex flex-col gap-4 max-w-sm mx-auto">
          <input 
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="w-full bg-white border border-maroon/10 rounded-full px-6 py-3 outline-none focus:border-maroon transition-all text-sm"
            placeholder="Masukkan nama Anda..."
          />
          <button 
            onClick={generateInvite}
            disabled={isGenerating || !guestName}
            className="w-full bg-[#4A0404] text-white py-3 rounded-full text-xs uppercase tracking-widest font-bold shadow-lg hover:bg-maroon transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? <Clock size={14} className="animate-spin" /> : <Sparkles size={14} />}
            ✨ Buat Pesan Berbagi
          </button>
        </div>

        <AnimatePresence>
          {inviteText && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }}
              className="mt-10 p-8 bg-white rounded-3xl border border-maroon/10 shadow-sm text-left relative"
            >
              <p className="text-stone-600 italic text-sm leading-relaxed whitespace-pre-wrap">{inviteText}</p>
              <button 
                onClick={copyToClipboard}
                className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-maroon hover:opacity-70 transition-all"
              >
                <Copy size={12} /> Salin Pesan
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

/**
 * BAGIAN KADO DIGITAL
 */
function GiftSection() {
  const [copied, setCopied] = useState(null);
  const copy = (txt) => {
    document.execCommand('copy');
    setCopied(txt);
    setTimeout(() => setCopied(null), 2000);
  };

  const accounts = [
    { bank: 'DANA', num: '081997723219', name: 'Alul' },
    { bank: 'Seabank', num: '901875071638', name: 'Dewi' }
  ];

  return (
    <section className="py-32 bg-white text-center px-6">
      <div className="max-w-3xl mx-auto">
        <Gift className="mx-auto text-maroon mb-8" size={40} />
        <h2 className="text-4xl font-serif italic text-maroon mb-6">Tanda Kasih</h2>
        <p className="text-stone-500 text-sm mb-16 leading-relaxed max-w-lg mx-auto">Doa restu Anda adalah kado terindah bagi kami. Namun jika ingin memberikan tanda kasih secara digital, silakan melalui:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {accounts.map((acc, i) => (
            <div key={i} className="p-10 rounded-3xl bg-stone-50 border border-maroon/5 border-solid hover:border-maroon/20 transition-all relative group overflow-hidden">
              <div className="relative z-10">
                <p className="text-[10px] uppercase tracking-[0.2em] text-maroon/40 mb-3 font-bold">{acc.bank}</p>
                <p className="text-3xl font-serif text-maroon mb-1 tracking-tight">{acc.num}</p>
                <p className="text-xs text-stone-500 mb-8 font-medium">a.n {acc.name}</p>
                <button onClick={() => copy(acc.num)} className="flex items-center gap-3 mx-auto px-5 py-2 bg-maroon/5 rounded-full text-[10px] uppercase tracking-widest font-bold text-maroon hover:bg-maroon hover:text-white transition-all shadow-sm">
                  {copied === acc.num ? <Check size={14} /> : <Copy size={14} />} {copied === acc.num ? "Tersalin" : "Salin Rekening"}
                </button>
              </div>
              <div className="absolute top-[-20px] right-[-20px] opacity-[0.03] group-hover:opacity-[0.05] transition-all">
                <Info size={120} className="text-maroon" />
              </div>
            </div>
          ))}
        </div>

        <div className="inline-block p-10 bg-maroon rounded-[2.5rem] shadow-2xl">
          <div className="bg-white p-6 rounded-2xl shadow-inner mb-6 flex flex-col items-center justify-center border-4 border-maroon/10">
            {QRIS_IMG ? (
              <img src={QRIS_IMG} alt="QRIS" className="w-48 h-48 object-contain" />
            ) : (
              <div className="w-48 h-48 bg-stone-50 rounded-xl flex items-center justify-center border-2 border-dashed border-stone-200">
                <span className="text-[10px] text-stone-300 font-bold uppercase tracking-widest text-center">Scan QRIS Anda<br/>di Sini</span>
              </div>
            )}
          </div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#FDFCF8] font-bold">Digital Wedding Gift</p>
        </div>
      </div>

      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spin-slow-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        .animate-spin-slow { animation: spin-slow 30s linear infinite; }
        .animate-spin-slow-reverse { animation: spin-slow-reverse 35s linear infinite; }
      `}</style>
    </section>
  );
}
