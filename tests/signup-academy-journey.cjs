const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const directory = read('src/app/academies/page.tsx');
const signup = read('src/components/auth/signup-form.tsx');
const profile = read('src/app/a/[slug]/page.tsx');
const button = read('src/components/academies/join-academy-button.tsx');
const modal = read('src/components/academies/join-academy-suggestion.tsx');
const onboarding = read('src/components/academies/academy-suggestion-onboarding.tsx');
const dashboard = read('src/components/dashboard/member-dashboard.tsx');
const css = read('src/app/globals.css');

// --- signup never offers an academy --------------------------------------
assert.doesNotMatch(
  signup,
  /signup_joining_academy/,
  'the "you are joining" banner is gone from signup'
);
assert.doesNotMatch(
  signup,
  /<JoinAcademyButton|name="academy_id"|academy_id:/,
  'signup collects no academy'
);
assert.match(
  signup,
  /const joiningAcademyId = searchParams\.get\("academy"\)/,
  'the academy the visitor came from is still remembered, just not shown'
);
const memberJoin = signup.slice(
  signup.indexOf('const onJoin = async'),
  signup.indexOf('const MEMBER_STEP_FIELDS')
);
assert.doesNotMatch(memberJoin, /academy_id/, 'the member signup sends no academy id');
assert.match(memberJoin, /academy_code/, 'the pre-existing invite-code option is untouched');
console.log('PASS: a first-time member is never asked to choose an academy while signing up');

// --- the suggestion arrives before the dashboard -------------------------
assert.match(
  signup,
  /pendingNav\.current = navigate;[\s\S]{0,200}setSuggestOpen\(true\)/,
  'the suggestion is queued before the navigation to the dashboard'
);
assert.match(
  signup,
  /onDone=\{\(\) => \{[\s\S]{0,300}go\(\);/,
  'dismissing the suggestion continues to the dashboard'
);
assert.doesNotMatch(
  signup.slice(signup.indexOf('<JoinAcademySuggestion'), signup.indexOf('</JoinAcademySuggestion>') + 24),
  /setPushPromptOpen\(true\)/,
  'a new member is not made to dismiss a second dialog'
);

// A member gets one dialog. Someone opening an academy still gets the push
// prompt, because new bookings are the thing they need to hear about.
const sessionBranch = signup.slice(
  signup.indexOf('const { session } = await signUp'),
  signup.indexOf('setConfirming(true)')
);
assert.match(
  sessionBranch,
  /if \(destination !== "\/dashboard" && !academy\?\.newName\)[\s\S]{0,400}else if \(academy\?\.newName\)[\s\S]{0,400}setPushPromptOpen\(true\)[\s\S]{0,400}else[\s\S]{0,400}setSuggestOpen\(true\)/,
  'a game invite goes straight through, an academy owner gets the push prompt, a member gets the suggestion'
);
assert.doesNotMatch(
  sessionBranch,
  /setSuggestOpen\(true\)[\s\S]{0,200}academy\?\.newName/,
  'an academy owner is never asked to join an academy'
);
assert.match(signup, /<JoinAcademySuggestion/, 'the modal is rendered after signup');
assert.match(
  signup,
  /registrationDestination\(searchParams.get\("redirectedFrom"\), gameInvite\)/,
  'the member still lands on the dashboard'
);
console.log('PASS: signup shows the academy suggestion, then the dashboard');

// --- the suggestion is not lost when email confirmation is required ------
const parkBlock = signup.slice(
  signup.indexOf('// No session until the email is confirmed'),
  signup.indexOf('setConfirming(true)')
);
assert.match(parkBlock, /localStorage\.setItem\(SUGGEST_ACADEMY_KEY/, 'the offer is parked when there is no session yet');
assert.match(
  parkBlock,
  /if \(destination === "\/dashboard" && !academy\?\.newName\)/,
  'neither an academy owner nor a game invite is parked an offer they never asked for'
);
assert.match(
  onboarding,
  /localStorage\.getItem\(SUGGEST_ACADEMY_KEY\)/,
  'the dashboard picks the offer back up'
);
assert.match(onboarding, /if \(hasAcademy\) return;/, 'someone who already joined is not prompted again');
assert.match(
  dashboard,
  /<AcademySuggestionOnboarding[\s\S]{0,120}hasAcademy=\{!!p\.academy_id\}/,
  'the dashboard mounts the offer and knows whether it still applies'
);
console.log('PASS: the offer survives the email confirmation hop');

// --- the suggestion is about a favourite sport ---------------------------
assert.match(modal, /suggest_sport_question/, 'it asks which sport the member plays');
assert.match(
  modal,
  /\(sports \?\? \[\]\)\s*\.filter\(\(row\) => row\.name === sport\)\s*\.map\(\(row\) => row\.academy_id\)/,
  'it only offers academies that actually teach the chosen sport'
);
assert.match(
  modal,
  /\.sort\(\(a, b\) => b\.count - a\.count \|\| a\.name\.localeCompare\(b\.name\)\)/,
  'sports are ordered by how many academies teach them'
);
assert.match(
  modal,
  /a\.id === highlightAcademyId \? -1 : b\.id === highlightAcademyId \? 1 : 0/,
  'the academy they came from is listed first'
);
assert.match(modal, /suggest_skip/, 'skipping is always possible');
assert.match(
  modal,
  /onInteractOutside=\{\(event\) => event\.preventDefault\(\)\}/,
  'the offer cannot be dismissed by an accidental click outside'
);
console.log('PASS: the suggestion matches a favourite sport and is easy to decline');

// --- joining still goes through the audited RPC --------------------------
assert.match(modal, /await joinPublicAcademy\(academy\.id\)/, 'joining uses the existing RPC');
assert.doesNotMatch(
  modal,
  /from\("profiles"\)\.update/,
  'the client never writes the member profile directly'
);
console.log('PASS: joining goes through the same audited path as the directory');

// --- the modal is animated, and motion-safe ------------------------------
for (const token of [
  'animate-suggest-rise',
  'animate-suggest-float',
  'animate-suggest-sheen',
  'animate-suggest-stagger',
  'animate-suggest-draw',
  'animate-suggest-burst',
  'animate-suggest-ring',
]) {
  assert.ok(css.includes(`.${token}`), `${token} is defined`);
  assert.ok(modal.includes(token), `${token} is actually used`);
}
assert.match(
  css,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,400}animate-suggest-rise/,
  'every animation is disabled when the reader asked for less motion'
);
assert.match(modal, /animationDelay: "-4\.5s"/, 'the two background orbs drift out of step');
assert.match(
  css,
  /animation-delay: calc\(var\(--i, 0\) \* 55ms\)/,
  'the cascade is driven by a per-item index'
);
assert.match(
  modal,
  /style=\{\{ "--i": index \} as React\.CSSProperties\}/,
  'each card sets its own position in the cascade'
);
assert.match(modal, /strokeDashoffset="48"/, 'the success tick is drawn on, not just shown');
assert.match(modal, /function AuroraBackdrop/, 'the modal has a layered decorative backdrop');
assert.match(modal, /<AuroraBackdrop \/>/, 'the backdrop is rendered behind the content');
console.log('PASS: the popup is animated throughout and honours reduced-motion');

// --- an academy link is still joinable ------------------------------------
assert.match(profile, /<JoinAcademyButton\s+academyId=\{academy\.id\}/, 'the academy page offers a join action');
assert.match(button, /router\.push\(`\/signup\?academy=\$\{academyId\}`\)/, 'a visitor without an account is carried into signup');
assert.match(button, /joinPublicAcademy\(academyId\)/, 'an existing member joins directly');
console.log('PASS: an academy link remains actionable for new and existing members');

console.log('\nAll post-signup academy suggestion tests passed.');