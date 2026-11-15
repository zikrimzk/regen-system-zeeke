# Mochi personal coach

Mochi sits directly in the landing hero and floats on signed-in pages. Visit **Mochi’s room** at `/mochi` from the account menu or Mochi’s Options to play on a larger stage. There are 48 activities, including yarn, climbing, zoomies and a long call. Choose a game or let him pick. Tap twice to tickle, or drag him out of the way. Keyboard users can move him with the arrow keys and return him to his original spot with Escape. Meows, giggles and purrs are quiet until the user turns on sound. The 3D renderer starts when the mascot enters the viewport and adapts to screen density. Devices without WebGL use the illustrated mascot; reduced-motion preferences turn off movement.

New users get a quiet **Let’s kenal** invitation. The introduction is optional. Mochi remembers a nickname, career stage, goal, coaching style, and language only when the user chooses **Remember this**. Users can edit or forget those details in **Options**. The moon button (or “Good night Mochi” in chat) puts him to sleep across pages until the user wakes him. After a few activities, he may take a 28–48 second nap on his own. Tapping cannot wake him from this nap. While he sleeps, the server rejects AI chat and field feedback requests.

**Help me here** starts a coaching conversation. Mochi can ask for a missing fact and use the answer to finish a draft. **Share this field** includes the field or selected passage. **Share letter and role** also includes the role, employer and job description. **Use saved resume** opts in to sharing saved professional details for that chat. Coaching includes up to eight recent messages from the writing conversation. ReGen clears the chat when the user leaves the page. Switching cover letters starts a fresh conversation.

**Ask about ReGen** handles account, billing, exports and other common issues, including on play-only packages. It can open the support form with the topic selected. Play, short check-ins, basic tips and support run locally. **Live field feedback** sends short excerpts when enabled.

## Add Mochi to a package

1. In ReGen Administration, open **Pricing → Packages**.
2. In **Included features → Coaching and AI writing**, use **Play with Mochi** for play alone. Use **Mochi chat and writing help** for chat plus play, with an unlimited allowance or a set number of successful AI replies.
3. Under **Hide unavailable tools**, select optional writing tools you want removed when a customer has no access. A tool available through another package or a public rule stays visible. Save and preview the offer in the Store. Existing **Mochi personal coach** grants still include play and chat. Users without a Mochi benefit see the adoption preview.

Open **Administration → Mochi** in the sidebar. **Availability** controls the master switch, landing preview, and schedule in Malaysia time. **Play & reactions** controls pace, naps, sound, editor reactions, and health. **AI spending** shows daily request counts and limits, with a switch and interval for live field feedback. Set the daily app cap to zero to pause all Mochi AI. **Account limits** lets you look up a customer and adjust their access. Every model call counts toward the daily API limit, which resets at midnight Malaysia time. A clarification leaves the customer's package allowance available for the answer or draft.

Existing grants keep the benefits they were issued with. To give an existing customer Mochi, explicitly update their grant through **Users → Packages** or issue a package that includes it. Apply **027_mochi_personal_coach.sql** before deploying this version; fresh installations already include the table. The package price is set in the package editor. The release does not change published prices.

## Enable personalized AI chat and live feedback

Mochi uses [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) through the OpenAI Responses API. It uses the same `OPENAI_API_KEY` as ReGen’s other AI features. GPT-6 Luna returns the coaching text and an expression for the 3D character to play. Tapping, sleeping, and basic field tips run in the browser.

1. Deploy the release to DirectAdmin. If the server’s existing `.env` already has a working `OPENAI_API_KEY` with access to GPT-6 Luna, Mochi’s AI is ready for accounts with the package benefit. The PHP host needs outbound HTTPS access to `api.openai.com`.
2. To override Mochi’s default model, set `MOCHI_OPENAI_MODEL` in the server’s `.env`. Use `MOCHI_AI_ENABLED=false` to turn off hosted chat and live comments while keeping the mascot and basic field tips.
3. Sign in to staging with a test account whose package includes Mochi. Save a fictional nickname and goal, open a resume section, and ask “Can you polish my resume summary?” Check that the answer uses the goal and the correct section. Turn on **Live field feedback** and test a fictional contribution. Put Mochi to sleep, reload, and verify he stays quiet. Also test an account without the package. The launcher should offer packages and the model endpoints should deny access.

OpenAI charges for the tokens used. At standard GPT-6 Luna pricing, 1,000 replies with 1,000 input and 150 output tokens each cost about US$0.18. Costs vary with chat length and the excerpt shared. The account’s OpenAI project rate limits still apply. See [OpenAI pricing](https://developers.openai.com/api/docs/pricing).

Live field feedback is off by default for users. People who opted in when it ran locally need to turn it on again for OpenAI. It sends a short excerpt from a supported writing field after a typing pause, at most once per configured interval per account. Mochi pauses feedback while asleep. ReGen redacts common emails, links, and phone numbers and sends requests with response storage disabled. OpenAI’s abuse monitoring policy still applies. See [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

Chat defaults to Malaysian Malay mixed with English. Mochi helps with resumes and cover letters, and can exchange short playful messages. When a user shares a field and asks for help, a suitable replacement includes **Use suggestion**. ReGen asks the user to share again if the field changed while the suggestion was open.

The local checks are `php scripts/check-mochi.php`, `php scripts/check-mochi-http.php` with a local development MySQL instance, and `node scripts/check-mochi-browser.cjs` with Playwright and Chrome. They use fictional text and a mock model.

## Mascot asset

The current 3D character is sculpted and animated in `public/js/mochi-avatar.js` using the original character sheet as reference. The illustrated fallback, `public/img/mochi-coach.webp`, was generated with the built-in imagegen tool from the sheet and resized to a 240 px transparent WebP.

Prompt: “Use case: stylized-concept. Asset type: small transparent in-app mascot sticker for the ReGen workspace. Input image: user-provided Mochi character sheet, a reference for the exact character identity and the sitting pose. Draw one single full-body Mochi sitting, facing the viewer, with one little paw raised as a friendly greeting. Closely match the sheet: pale leaf-green floppy bunny ears, soft cream face and belly, two curved green antennae with glowing lime buds, yellow flower on viewer-left, green leaf scarf with tiny charm, wide dark green eyes, rosy pink cheeks, tiny paws, and a warm smile. Match the soft hand-drawn kawaii watercolor finish, clean silhouette, and palette. Center tightly in a square with about 5% padding and no cropping. Make the features read at 40 px. True transparent background, clean alpha, no floor, no background, no text, no borders, no lettering, no extra characters or sheet layout.”
