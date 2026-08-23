# Spec — "Imposter" mini-app (`com.example.imposter`)

Status: **approved, ready to build** · Target version: `0.1.0` · Kind: mini-app (catalog addition)

---

## Problem Statement

A group of people sitting around one table wants to play a social-deduction party game — the
kind where everyone shares a secret word except one person, who has to bluff their way through
without ever having heard it. Playing this without an app means one person has to sit out to act
as narrator, write words on scraps of paper, and be trusted not to leak anything. Playing it with
an existing app means leaving the super-app and installing something from a store.

Concretely, three problems:

1. **Someone has to be the dealer.** Assigning a secret word to N people, secretly picking one
   imposter, and telling nobody who it is cannot be done fairly by a player — the dealer always
   knows the answer and is therefore excluded from the fun.
2. **Secrets leak on a shared device.** Once the group agrees to pass a phone around, the phone
   becomes the weak point: a word left on screen during a hand-off, a bright screen readable from
   across the table, or an imposter's screen that looks visibly different at a glance all destroy
   the round irrecoverably. There is no undo for a leaked secret.
3. **Nobody in the room knows the truth at the end.** After the argument, the group needs an
   authoritative reveal. Relying on the imposter to confess honestly is relying on the one player
   whose entire incentive is to lie.

The catalog also has a gap: `game-2048`, `game-snake` and `pomodoro` are all single-player,
single-user apps. There is no multi-person mini-app in the catalog, and no mini-app whose primary
value comes from bundled content rather than from an algorithm.

## Solution

A **pass-and-play secret-word dealer** that runs inside the super-app as a mini-app. It does the
dealing and the revealing, and deliberately does nothing else — the discussion, the accusations
and the verdict all happen out loud between humans.

The organizer enters everyone's name once, picks which word categories are in play and how obscure
words are allowed to get, and hits Start. The app draws one word, secretly designates exactly one
player as the imposter, then walks the phone around the table: each player is named on screen
before anything is revealed, holds a button to see their secret, and releases it — which hides the
secret and advances to the next player, so the phone can never be handed over showing anything.
The crew all see the same word; the imposter is told plainly that they are the imposter and is
given a hand-written one-line hint instead of the word, so they have something real to bluff with.

Once everyone has looked, the app names who speaks first and gets out of the way. When the group
has finished arguing, one deliberate tap reveals who the imposter was and what the word had been.
"New round" re-draws everything for the same group without re-typing a single name.

The whole app is offline. It requests only `storage` and `toast` from the bridge; it never touches
the network. Its value lives in 1000 hand-authored word/hint pairs shipped inside the package.

## User Stories

**Setting up a game**

1. As an organizer, I want to type each player's name once, so that the app can address people by
   name instead of "Player 3" and the table always knows whose turn it is.
2. As an organizer, I want the app to remember the roster from last time, so that a group that
   plays several sessions doesn't retype eight names every weekend.
3. As an organizer, I want to land on the editable setup screen even when a saved roster exists,
   so that I can drop the person who went home before dealing them a word.
4. As an organizer, I want to add and remove players freely before starting, so that the roster
   matches who is actually at the table.
5. As an organizer, I want to be told immediately when I enter a duplicate name, so that "pass the
   phone to Karim" is never ambiguous.
6. As an organizer, I want long names rejected at the input rather than silently shortened, so that
   I understand the limit instead of thinking the app corrupted someone's name.
7. As an organizer, I want to be prevented from starting with fewer than three players, so that I
   don't begin a round that is mathematically a coin flip.
8. As an organizer, I want an upper bound on players, so that the pass-around phase doesn't turn
   into two minutes of dead time that makes the app feel broken.
9. As an organizer, I want to choose which categories are in play, so that the group can steer
   toward the subjects they enjoy.
10. As an organizer, I want to combine several categories in one game, so that the word pool feels
    unpredictable rather than themed.
11. As an organizer, I want to be prevented from starting with zero categories selected, so that
    the app never has to fail after I've already hit Start.
12. As an organizer, I want to choose how obscure words may get, so that a group of strangers and a
    group of trivia obsessives can both enjoy the same app.
13. As an organizer, I want my category and difficulty choices remembered, so that the next session
    starts the way the last one ended.
14. As an organizer, I want the app to survive stale or corrupted saved settings by falling back to
    sane defaults, so that a bad save from an old version never stops us playing.

**Being dealt a secret**

15. As a player, I want the screen to name whose turn it is *before* anything is revealed, so that
    I never accidentally burn someone else's turn.
16. As a player, I want to hold a button to see my secret and have it vanish the instant I let go,
    so that it is physically impossible to hand the phone on while my word is showing.
17. As a player, I want releasing the button to move straight to the next player, so that nobody
    has to remember to tap "hide" and no secret is ever left sitting on screen.
18. As a player, I want to be able to look again as many times as I need while it's still my turn,
    so that a notification or a distraction doesn't cost me the round.
19. As a player, I want my secret to be unavailable once I've passed the phone on, so that a
    suspicious imposter can't re-read their hint after hearing four clues.
20. As a crew member, I want to see exactly the same word as every other crew member, so that the
    game has a shared truth to converge on.
21. As an imposter, I want to be told plainly that I am the imposter, so that I don't waste the
    round confused about whether my screen is broken.
22. As an imposter, I want a hint rather than nothing at all, so that I can bluff credibly instead
    of stalling and being caught on my first turn.
23. As an imposter, I want my hint never to contain the word itself, so that the game isn't
    trivially given away.
24. As an imposter, I want my screen to be laid out identically to a crew member's, so that nobody
    identifies me from two feet away without reading a single word.
25. As a player, I want the reveal screen to stay dark even when the host app is in light mode, so
    that a bright screen in a dim room doesn't broadcast my secret across the table.
26. As a player, I want the secret rendered large and alone with no surrounding chrome, so that I
    can read it in the quarter-second I have while being watched.
27. As a player, I want the app to return to a safe state if it gets backgrounded mid-pass, so that
    a phone call doesn't leave a half-dealt round in an ambiguous state.
28. As a player, I want no visible indication of which category the word came from, so that a
    multi-category game doesn't quietly hand the imposter free information.

**Playing the round**

29. As a group, I want the app to name who speaks first, so that we don't lose fifteen seconds
    every round negotiating who starts.
30. As a group, I want the app to state the direction of play, so that "who's next?" never
    interrupts the momentum.
31. As a group, I want the starter to be chosen with no regard for who the imposter is, so that no
    pattern across rounds ever leaks the answer.
32. As a group, I want the app to be silent and idle during the discussion, so that nothing on
    screen distracts from the conversation, which is the actual game.

**Resolving and replaying**

33. As a group, I want a deliberate, hard-to-mis-tap action to reveal the answer, so that nobody
    fat-fingers the truth into view mid-argument.
34. As a group, I want the reveal to name the imposter *and* show the word, so that the crew learns
    how close they were and the imposter's clues can be re-examined.
35. As a group, I want an authoritative reveal from the app rather than a confession, so that we
    don't have to trust the one player whose job was to lie.
36. As a group, I want to start another round with the same players in one tap, so that six rounds
    back-to-back involves zero setup.
37. As a group, I want every new round to re-draw the word, the imposter and the starter, so that
    nothing carries over and no inference from the last round is valid.
38. As a group, I want to go back and edit the roster between rounds, so that arrivals and
    departures are easy to handle.
39. As a returning group, I want the words we recently played to be excluded from the draw, so that
    "1000 words" is true in play and not just in the data.
40. As a returning group, I want repeats to become possible again once we've exhausted the filtered
    pool, so that a narrow category selection never leaves the app unable to deal.
41. As a player, I want the same person being imposter twice in a row to remain possible, so that
    nobody can eliminate a suspect purely from the previous round's reveal.

**Content quality**

42. As a player, I want every word to be something I plausibly recognize at the chosen difficulty,
    so that an innocent player with nothing to say doesn't look exactly like the imposter.
43. As a player, I want hints calibrated so the imposter is neither instantly caught nor
    indistinguishable from the crew, so that both sides of the round are fun.
44. As a player, I want a word never to appear in two different categories, so that a
    multi-category draw can't be biased toward it.
45. As a group on Easy, I want a deep enough easy pool that the setting is usable, so that the
    least-obscure difficulty isn't also the most repetitive.

**Living in the super-app**

46. As a super-app user, I want the mini-app to appear as a card in the home grid with a
    recognizable icon, so that I can find it among the other mini-apps.
47. As a super-app user, I want the ✕ in the header to dismiss the mini-app, so that it behaves like
    every other mini-app in the catalog.
48. As a super-app user, I want a short "what is this" blurb available in-app, so that I can explain
    the game to the table without leaving it.
49. As a super-app user, I want the setup and round screens to follow the host's light/dark theme
    (the reveal screen excepted), so that it feels native inside the host.
50. As a super-app user, I want the mini-app to request only the permissions it genuinely uses, so
    that a party game isn't asking for network access.
51. As a maintainer, I want the app published to the static registry and listed in the catalog, so
    that it reaches devices without a host release or an app-store submission.
52. As a maintainer, I want the app covered by the existing CI matrix, so that a content or logic
    regression fails the build rather than the party.

## Implementation Decisions

**Identity and placement.** A new mini-app in the catalog alongside the existing three, following
the established folder-naming convention for games. Reverse-DNS id `com.example.imposter`, display
name "Imposter", initial version `0.1.0`. The name is deliberately genre-generic rather than
matching the commercial product that inspired it — the repo's README and screenshots are public,
and a card labelled with another product's brand would read as that product.

**Bridge surface and permissions.** Manifest permissions are `["storage", "toast"]` with an empty
`allowedDomains`. `storage` persists setup and the recent-word buffer; `toast` backs the About
blurb. The app uses `mini.system.getInfo()` for theme, `mini.navigation.close()` for the header ✕,
and **no** `network` permission — the entire word catalog ships inside the `.mpkg`. `mini.host.*`
is not used, so the app is portable to any conformant host.

**Rules, fixed for `0.1.0`.** Three to twelve players. Exactly one imposter. Crew all receive an
identical word; the imposter receives an explicit imposter designation plus a hint and never the
word. The imposter is drawn uniform-random with **no** back-to-back exclusion — excluding the
previous imposter would remove a known suspect from the pool and leak information, and a repeat is
a good story rather than a defect. The starter is drawn uniform-random across all players
*including* the imposter, for the same reason: any non-uniform rule is inferable across rounds.

Despite there being exactly one imposter, the round state models it as a **list** of imposter
indices, not a single index. Supporting two imposters later then becomes a draw change plus a
setup toggle rather than a rewrite of the pass loop and the reveal screen. Multi-imposter is out of
scope for `0.1.0` because it raises an unanswered design question — whether imposters know each
other — that deserves its own decision rather than a default.

**Screen model.** Four screens: setup, the per-player pass-and-reveal loop, a round-ready screen
naming the starter, and a reveal screen. "New round" re-enters the pass loop directly with the same
roster and a freshly drawn word, imposter and starter. Nothing from the previous round is retained.

**The reveal interaction is the app's core mechanism and is specified tightly.** Each player's turn
is a two-step gate: a named interstitial ("Pass the phone to Karim") followed by a press-and-hold
reveal. The secret is rendered only while the pointer is down; release hides it and auto-advances
to the next interstitial. This is chosen over tap-to-reveal/tap-to-hide specifically because
tap-to-hide can be forgotten, and the failure it permits — handing over a phone showing the word —
is unrecoverable. Re-holding is permitted for as long as it is that player's turn and impossible
afterwards.

Two anti-leak requirements are load-bearing and must not be traded away for visual polish:

- The imposter's reveal is **layout-identical** to a crew reveal — same framing, same type scale,
  same amount of text on screen, same hold behavior. A visually distinguishable imposter screen is
  readable across a table without reading any words.
- The reveal screen is **force-dark regardless of host theme**, deliberately breaking the repo's
  follow-the-host-theme convention on that one screen. A full-brightness screen in a dim room is
  legible from several feet away and lights the holder's face.

The drawn word's category is never displayed anywhere in the round. With multiple categories
selected, showing it would narrow the field for the imposter for free.

**Round state is not persisted.** Only setup and the recent-word buffer are written to storage. If
the app is backgrounded or destroyed mid-pass, it resumes at setup rather than resurrecting a
partially-dealt round, whose secrecy state cannot be reasoned about after the fact.

**Content schema and volume.** Five categories — Food & Drink, Animals, Places, Jobs, Objects —
each holding exactly 200 entries, 1000 total. Movies/TV and Famous People were rejected as
categories: both gate participation on cultural knowledge, and a player who genuinely doesn't know
the word is indistinguishable from the imposter, which reads as the app being broken.

Each entry carries an obscurity tier:

```
{ word: string, hint: string, level: 1 | 2 | 3 }   // 1 = universally known … 3 = niche
```

Tiers are assigned during authoring rather than retrofitted, because retrofitting means re-reading
all 1000 entries. They turn the unavoidable obscurity tail of a 200-word category from a defect
into a difficulty setting, and they provide a safety valve: if playtesting says the game is too
easy or too weird, the fix is a filter change rather than re-authoring content. Setup defaults to
levels 1–2 with level 3 opt-in.

Content is organized under a locale directory from day one so that a non-English pack can be added
without touching game logic. English only for `0.1.0`: word lists don't translate, they have to be
re-authored per culture, and hint calibration is the product — writing two languages at once halves
the care per hint.

At roughly 90 KB of JSON (about 30 KB compressed) the full catalog is small enough to ship eagerly
inside the package with no lazy-loading or splitting.

**The draw excludes recent words.** A persisted ring buffer holds the last 30 drawn word
identifiers, which are excluded from the draw. If the filtered pool (category × difficulty) is
entirely covered by the buffer, the buffer clears and the draw proceeds — so a narrow selection
degrades to repeats instead of failing. The buffer is global rather than per-category, since the
player experiences one stream of words regardless of category. Without this, a small filtered pool
repeats within a single session and players read the repeat as a bug.

**Storage keys are versioned** (setup and recents each under their own versioned key) so that a
future schema change is discarded cleanly rather than crashing on stale JSON from an older package.
Reads treat stored data as untrusted input: parse failures and shape mismatches fall back to
defaults.

**Randomness is injected, not global.** The round draw takes a random source as a parameter,
defaulting to the platform generator. This is the decision that makes the whole game testable;
mocking the global generator instead would make tests order-dependent.

**Session module boundary.** The game is one module exposing the round lifecycle — load persisted
setup, validate a roster and start a round, re-draw for a new round — with two injected ports: the
random source and a minimal key/value storage interface (`get`/`set`). The React layer holds no
game rules; it renders session output and forwards intent. See Testing Decisions for why the
persistence logic lives behind this boundary rather than in a sibling module.

**Presentation.** Hand-written CSS with custom properties, no UI library — consistent with every
other mini-app here, and a component library would cost bundle size for four screens. Theme is
driven from the bridge's reported theme, with the documented reveal-screen exception. The reveal
screen is high-contrast with the secret at display size and nothing competing with it; the setup
screen may be friendlier and denser.

**Icon.** A flat 256 px PNG generated by a small committed script rather than a binary of unknown
provenance, so it can be regenerated and reviewed. Base64-encoded into the catalog entry per the
existing catalog convention.

**Delivery pipeline.** Scaffold, build, typecheck and tests green, add the app to the CI matrix
(which is a hardcoded list and does not pick up new apps automatically), pack, inspect the package,
publish to the static registry, append the catalog entry, and update the root README's structure
tree. Content is authored in five sequential passes, one category per pass, each reviewed before
the next begins — so a miscalibrated hint voice is caught at entry 200 rather than entry 1000.

## Testing Decisions

**What a good test looks like here.** Tests assert externally observable behavior through a public
module surface: given this roster, this pool and this random source, what did the deal produce and
what got persisted. They never reach for internal helpers, never assert on how a draw was
implemented, and never assert on rendered markup. Every test is deterministic — the random source
and the storage layer are both injected, so no test mocks a global or depends on execution order.

**Seam 1 — the session module (the only behavioral seam).** All behavioral tests go through it,
with a stub random source and an in-memory storage fake:

- exactly one imposter is designated, and the count holds across player counts from 3 to 12
- every non-imposter receives an identical word
- the imposter receives the hint and, in no circumstance, the word
- the starter index is always within the roster, and the imposter is a possible starter
- roster validation: below-minimum and above-maximum player counts, duplicate names, over-length
  names, and empty category selection are all rejected before a round can begin
- the draw respects the active category and difficulty filters
- recently drawn words are excluded from the draw
- the recents buffer self-clears when the filtered pool is exhausted, and the draw still succeeds
- setup round-trips through storage
- corrupt, truncated and stale-schema stored data fall back to defaults instead of throwing

This is **one seam higher than the prior art**, which splits pure logic and persistence into two
sibling modules with a test file each. That split is right where serialization is genuinely
separable from the rules; it is wrong here, because the most important persistence assertions —
"recent words are excluded from the draw" — span the draw and storage simultaneously, and a
two-seam layout would force those tests to reach through both modules. Collapsing to one seam with
an injected storage port keeps every assertion on a single public surface.

**Seam 2 — the content catalog (a data contract, not a code seam).** Lint assertions over the
exported catalog, guarding 1000 hand-authored entries whose defects are invisible in review and
fatal in play:

- exactly five categories of exactly 200 entries each, asserted as hard counts, so a truncated
  paste during authoring fails the build instead of shipping
- every entry has a non-empty word and a non-empty hint, and a tier within the allowed set
- **no hint contains its own word** (case-insensitive, stem-aware) — the single most likely
  authoring mistake, and one that silently hands the answer to the imposter
- words are unique within a category *and* globally, so a multi-category draw can't be biased
- every category holds at least 40 tier-1 entries, so the easiest difficulty can never starve

The hard count assertion is deliberately strict: changing a category's size is intended to be a
decision that updates the test, not a silent drift.

**Not tested, matching the repo.** React components and hooks. The prior art leaves its equivalent
hook and all components untested, and the game rules live entirely behind seam 1, so component
tests would assert on markup for no behavioral coverage. The pass-and-hold interaction and the
force-dark reveal are verified by playtesting on a device, not in the suite.

**Prior art.** The pure-logic test file and the persistence test file in the existing 2048 mini-app
are the model for structure, naming and assertion style, including its corrupt-save handling.
Runner and commands are the repo standard, and the app joins the existing CI matrix which runs
typecheck, tests, pack and package inspection per app.

## Out of Scope

- **In-app voting, discussion timers, and scoring.** The app deals and reveals; the argument is
  human. Voting is a second full pass-and-play loop and scoring needs cross-round player identity —
  both are deferred until real play says they're wanted.
- **Multiple imposters.** Modelled for in the state shape, not implemented, and blocked on the
  "do imposters know each other" design question.
- **Networked or multi-device play.** The bridge surface is frozen and offers HTTP requests only —
  no sockets, no push, no peer discovery — and there is no backend in this repo or anywhere to host
  one. Single-device pass-and-play is the only honest option.
- **Non-English content.** Structured for, not shipped.
- **User-authored words or custom categories.** No editor, no import.
- **Movies/TV and Famous People categories.** Rejected on gameplay grounds, not deferred.
- **Player avatars, colors or emoji.** Names only.
- **Sound and haptics.** No bridge support for haptics; audio in a party context is noise.
- **Decoy-word variant** (imposter receives a related word rather than a hint) and the
  blank-word variant. Hint-based was chosen; the alternatives are not built.
- **A README screenshot** for this app, which requires a device build against a running registry.
- **An issue-tracker entry.** This document is the spec of record.

## Further Notes

**The content is the product.** The code is roughly four screens and one pure draw function; the
1000 hint pairs are where the quality lives and where nearly all of the effort goes. Reviewing the
first category's hints carefully is the highest-leverage thing to do on this project — voice,
length and difficulty calibration set there will be replicated 800 more times.

**Secrecy is the one property with no undo.** Every decision that looks like polish — identical
imposter layout, force-dark reveal, hiding the drawn category, hide-on-release, no re-peek after
passing, uniform-random starter — is really a leak fix. If a trade-off ever pits one of these
against aesthetics or convenience, secrecy wins; a leaked round can't be recovered, whereas an
ugly screen can be restyled next version.

**This app fills a real gap in the catalog** beyond being another game: it's the first multi-person
mini-app, and the first whose payload is bundled content rather than an algorithm. That makes it a
useful data point for the playbook on how large a `.mpkg` can comfortably get and how a
content-heavy mini-app behaves through the registry's verify-then-extract path.

**Reference.** The game is modelled on the commercially available *Imposter Who?*
(`imposterwho.com`) as described by the requester: names, then categories, then a random word,
then a pass-around reveal where one player gets only a hint, then the app names who starts. Its
landing page documents nothing further, so the flow above is derived from that description rather
than from the product, and the deliberate additions are the in-app reveal, difficulty tiers, and
recent-word exclusion.
