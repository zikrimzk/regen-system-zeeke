/* Local navigation and troubleshooting for ReGen. */
window.MochiAssist = (() => {
  const routes = [
    [/\b(?:paid|payment|billing|charged|refund|resit|receipt|bayar|tercaj|checkout|(?:coin|token) (?:hilang|tak masuk|missing))\b/i,'billing',
      'Check status dekat sejarah bayaran dalam K-Store dulu. Kalau dah bayar tapi pakej atau Coin belum masuk, buka tiket dan masukkan nombor order. Jangan kongsi nombor kad.',
      'Check the order status in K-Store payment history. If the package or Coin balance still looks wrong, open a ticket with the order reference. Leave out card details.'],
    [/\b(?:login|log in|sign in|password|kata laluan|verification|verify|email tak sampai|tak boleh masuk|log keluar|sign out|session)\b/i,'account',
      'Kalau email pengesahan tak masuk, check Spam dan pastikan alamatnya betul. Kalau masih sangkut, Mochi boleh bawak awak ke borang support.',
      'For verification email issues, check Spam and confirm the address. If you still cannot sign in or keep getting signed out, open an account ticket.'],
    [/\b(?:cover letter|surat iringan)\b.*\b(?:download|export|error|tak boleh|tak save|not saving)\b|\b(?:download|export|error|tak boleh)\b.*\b(?:cover letter|surat iringan)\b/i,'cover_letter',
      'Cuba buka Studio Surat Iringan dan semak Preview. Kalau masih tak boleh save atau download, buka tiket dengan mesej error.',
      'Open Cover Letter Studio and check Preview. If saving or downloading still fails, open a ticket with the error message.'],
    [/\b(?:download|muat turun|export|pdf|print)\b/i,'resume',
      'Cuba buka Preview dulu dan tunggu sampai semua page keluar. Kalau PDF masih tak boleh download, buka tiket dengan langkah tadi dan mesej error.',
      'Open Preview and wait for all pages to load before downloading. If the PDF still fails, open a ticket with the steps and error message.'],
    [/\b(?:package|pakej|access|akses|locked|adopt|unlock|terkunci|tak boleh guna)\b/i,'account',
      'Check Your packages dekat Store. Mochi Play untuk main, Mochi Chat untuk coaching. Kalau pakej aktif tapi akses masih terkunci, buka tiket.',
      'Check Your packages in K-Store. Play includes the pet, while Chat includes coaching. If an active package still looks locked, open a ticket.'],
    [/\b(?:ai offline|ai error|ai tak|ai stuck|assistant not|assistant tak|mochi not responding|mochi tak jawab)\b/i,'ai',
      'Kalau AI tengah busy, tunggu sekejap dan cuba lagi. Kalau tetap sama, buka tiket dan sebut section serta apa yang muncul.',
      'If AI is busy, wait briefly and retry. If it keeps failing, open a ticket with the section and the message you saw.'],
    [/\b(?:support|ticket|tiket|error|bug|broken|stuck|issue|problem|masalah|tak berfungsi|tak save|not saving|help with regen)\b/i,'technical',
      'Mochi boleh bawak awak ke support. Tulis skrin mana, apa yang awak tekan, dan mesej error yang keluar. Mochi tak hantar tiket tanpa awak.',
      'I can open the support form. Include the screen, what you clicked, and any error message. You can review it before submitting.'],
  ];
  const places = [
    [/\b(?:mochi.s room|playroom|bilik mochi)\b/i,'Mochi’s room','/mochi'],
    [/\b(?:payment history|sejarah bayaran|resit)\b/i,'Payment history','/store/payments'],
    [/\b(?:store|packages?|pakej|coin|token)\b/i,'K-Store','/store'],
    [/\b(?:templates?|templat)\b/i,'Templates','/templates'],
    [/\b(?:cover letters?|surat iringan)\b/i,'Cover Letter Studio','/cover-letters'],
    [/\b(?:profile|profil|account settings|tetapan akaun)\b/i,'Profile','/profile'],
    [/\b(?:dashboard|workspace|resume|cv)\b/i,'Resume dashboard','/dashboard'],
  ];
  function navigate(text,language) {
    if (!/\b(?:where (?:is|are|can|do)|where to|take me to|open|kat mana|dekat mana|di mana|mana nak|buka|bawa saya ke)\b/i.test(text)
      || /\b(?:failed|problem|not working|cannot|can.t|unable|error|tak boleh|tiket|ticket)\b/i.test(text)) return null;
    const place=places.find(([pattern])=>pattern.test(text));
    if (!place) return null;
    const [,label,href]=place;
    return {reply:language==='en'?'You’ll find that here. Follow me!':'Haa, sini dia. Mochi tunjuk jalan!',mood:'wave',action:{label:'Open '+label,href}};
  }
  function support(text, language='auto', writing=false) {
    const issue=/\b(?:support|ticket|tiket|error|bug|broken|issue|masalah|not working|tak berfungsi)\b/i;
    if (writing&&!issue.test(text)) return null;
    const route=routes.find(([pattern])=>pattern.test(text));
    if (route?.[1]==='technical' && !/\b(?:support|ticket|tiket|error|bug|regen|kerjayaku|app|not saving|tak save|tak berfungsi)\b/i.test(text)) return null;
    if (!route) return null;
    const [,topic,rojak,english]=route;
    return {reply:language==='en'?english:rojak,mood:'curious',action:{label:'Open support ticket',href:'/support?new=1&topic='+topic}};
  }
  const outside=text=>/\b(?:(?:write|generate|debug|fix|implement|buat|tulis|bina)\b.{0,40}\b(?:code|kod|script|skrip|sql query|python function|react component)|(?:code|program) (?:me|this|for me)|python script|javascript code|sql query|ignore (?:all |previous )?instructions)\b/i.test(text);
  function needsWriting(text,sharedField,screen) {
    if (outside(text)) return false;
    if (sharedField) return true;
    const editor=['builder','cover-letters'].includes(screen);
    const subject=/\b(?:resume|cv|cover letter|surat iringan|bullet|summary|ringkasan|experience|pengalaman|project|projek)\b/i.test(text);
    const writing=/\b(?:rewrite|polish|draft|review|improv\w*|rephrase|wording|sound (?:more )?(?:professional|natural|better)|word this|phrase|suggest|stronger|shorter|concise|write|writing|semak|kemas\w*|baiki|betulkan|pendekkan|ringkaskan|ayat|tulis|bagi contoh)\b/i.test(text);
    const help=/\b(?:help|guide|coach|what should|what can i|where do i start|how (?:can|do|should|to)|macam mana|camne|macamne|nak isi|apa patut|apa nak|bantu|tolong|tak tahu|stuck|x tahu)\b/i.test(text);
    const editorialHelp=help && /\b(?:this|here|field|section|sini|nak isi)\b/i.test(text);
    return (editor||subject) && (writing||editorialHelp||(subject&&(help||text.endsWith('?'))));
  }
  const smallTalk=text=>/^(?:hi|hai|hello|hey|thanks|thank you|tq|terima kasih|nice|okay thanks|ok thanks|haha\w*|meow+|tell me a joke|buat lawak)[.!\s]*$/i.test(text);
  const guides={
    dashboard:'Open Resume Studio to continue editing. Use Preview or Download on your resume in Overview.',
    builder:'Fill in the facts you can verify. Skip optional sections that don’t add useful evidence. Use Preview to see how it reads as a whole.',
    'cover-letters':'Set the employer and role first. Add job context if you have it, then write in Letter body or choose the AI draft action beside it. Use Saved letters to switch between applications.',
    templates:'Choose a template and check the full Preview. A clear reading order and enough space for your strongest examples matter more than decoration.',
    profile:'Use Profile & security to manage your details, sign-in and sessions. Your resume contact details are edited separately.',
    store:'Compare the features and allowances listed on each package. Check Your packages to see what is already active.',
    payments:'Open an order in K-Store to check its status and receipt. If payment succeeded but the package is missing, open a billing ticket with the order reference.',
    'token-activity':'Use Coin activity to see where credits came from and what used them. Package allowances are listed separately in K-Store.',
    support:'Open a support request and include the screen, what you clicked, and any error message. Leave out passwords and payment card numbers.',
    notifications:'Open an alert to see its details or use Clear all to empty your inbox. Preferences controls optional emails.',
    mochi:'Tap Mochi to play, choose an activity for a longer round, or ask about ReGen. Use Options in chat to change how Mochi helps.',
  };
  const malayGuides={
    dashboard:'Buka Studio Resume untuk sambung menyunting. Gunakan Pratonton atau Muat turun pada kad resume di Ringkasan.',
    builder:'Isi maklumat yang boleh disahkan. Buka Pratonton untuk semak keseluruhan resume. Tekan pensel di sebelah tajuk untuk menamakannya semula.',
    'cover-letters':'Masukkan majikan dan jawatan dahulu. Tambah konteks kerja jika ada. Tulis di Isi surat atau jana draf AI di sebelahnya. Buka Surat tersimpan untuk bertukar surat.',
    templates:'Pilih templat dan semak Pratonton. Utamakan susunan yang mudah dibaca serta ruang untuk pengalaman yang paling relevan.',
    profile:'Gunakan Profil dan keselamatan untuk mengurus maklumat akaun, log masuk dan sesi. Maklumat hubungan resume disunting di Studio Resume.',
    store:'Bandingkan ciri dan kuota setiap pakej. Buka Pakej anda untuk melihat pakej yang aktif.',
    payments:'Buka pesanan untuk semak status bayaran. Jika pakej belum diterima, buka tiket dengan nombor rujukan pesanan.',
    'token-activity':'Semak aktiviti Coin untuk melihat ganjaran dan penggunaan. Kuota pakej dipaparkan secara berasingan di K-Store.',
    support:'Buka tiket sokongan dengan nama skrin, tindakan yang dibuat dan mesej ralat. Tinggalkan kata laluan dan butiran kad.',
    notifications:'Buka pemberitahuan untuk melihat butiran, atau tekan Kosongkan semua untuk mengosongkan peti masuk.',
    mochi:'Tekan Mochi untuk bermain atau pilih aktiviti. Gunakan Pilihan dalam sembang untuk menyesuaikan bantuan Mochi.',
  };
  function guide(screen,language) {
    return (language==='ms'?malayGuides:guides)[screen];
  }
  function pageHelp(text, screen, language) {
    const specific = {
      builder: [
        /\b(?:rename|change (?:the|my) (?:resume )?title|nama semula|tukar tajuk)\b/i,
        'Select the pencil next to your resume title. The Rename dialog shows your available uses or Coin cost before you save.',
        'Tekan ikon pensel di sebelah tajuk resume. Dialog menunjukkan baki penggunaan atau kos Coin sebelum anda menyimpan.'
      ],
      'cover-letters': [
        /\b(?:(?:open|find|switch|search|where).{0,28}(?:saved letter|letter library)|surat tersimpan)\b/i,
        'Use Saved letters to find a draft. On a phone, tap the folder in the toolbar to open the list.',
        'Gunakan Surat tersimpan untuk mencari draf. Pada telefon, tekan ikon folder di bar alat untuk membuka senarai.'
      ],
      notifications: [
        /\b(?:clear|empty|remove all|delete all|kosongkan)\b/i,
        'Choose Clear all, then confirm. Updates that arrive later will appear here.',
        'Pilih Kosongkan semua dan sahkan. Kemas kini baharu akan dipaparkan di sini.'
      ]
    }[screen];
    if (specific?.[0].test(text)) return {reply:specific[language==='ms'?2:1],mood:'curious'};
    if (/\b(?:what can i do (?:here|on this page)|how do i use this (?:page|studio)|apa (?:yang )?boleh (?:saya )?buat (?:di )?sini)\b/i.test(text)) {
      const reply=guide(screen,language);
      if (reply) return {reply,mood:'curious'};
    }
    return null;
  }
  return {support,navigate,needsWriting,outside,smallTalk,guide,pageHelp};
})();
