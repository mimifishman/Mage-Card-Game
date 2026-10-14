import { Link } from "wouter";

// Rules mirror the game engine in artifacts/api-server/src/game. If a rule
// changes there, change it here too.

const sections: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "goal",
    title: "The goal",
    body: (
      <>
        <p>
          Every player is a mage. Each mage starts with <strong>20 life</strong>. When your
          life reaches 0, you are out. The <strong>last mage standing wins</strong>.
        </p>
      </>
    ),
  },
  {
    id: "setup",
    title: "Setup",
    body: (
      <ul>
        <li>2 to 4 players.</li>
        <li>
          One deck of <strong>54 cards</strong>: a normal 52-card deck plus 2 Jokers.
        </li>
        <li>
          The game shows one card for each player. The highest value goes first. On a tie,
          those players show new cards.
        </li>
        <li>
          Each player gets <strong>7 cards</strong>.
        </li>
        <li>Turns go around the table in order.</li>
      </ul>
    ),
  },
  {
    id: "values",
    title: "Card values and cost",
    body: (
      <>
        <p>Every card has a value. Most cards cost their value to play.</p>
        <table>
          <thead>
            <tr>
              <th>Card</th>
              <th>Value</th>
              <th>Cost to play</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Ace</td>
              <td>1</td>
              <td>1</td>
            </tr>
            <tr>
              <td>2 to 10</td>
              <td>Its number</td>
              <td>Its number</td>
            </tr>
            <tr>
              <td>Jack / Queen / King</td>
              <td>1 / 2 / 3</td>
              <td>1 / 2 / 3</td>
            </tr>
            <tr>
              <td>Diamonds (Ace to 10)</td>
              <td>Its number</td>
              <td>Free</td>
            </tr>
            <tr>
              <td>Joker</td>
              <td>&mdash;</td>
              <td>10</td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "energy",
    title: "Energy: the Mine and your Vault",
    body: (
      <>
        <p>
          You pay for cards with energy from your <strong>Vault</strong>.
        </p>
        <ul>
          <li>
            The <strong>Mine</strong> is one shared pile of Diamonds in the middle of the
            table. Every player adds to it.
          </li>
          <li>
            At the start of your turn, your Vault fills up to the total value of all Diamonds
            in the Mine.
          </li>
          <li>When you play a card, its cost comes out of your Vault for this turn.</li>
          <li>
            Diamonds that other players add to the Mine count for you from your next turn.
          </li>
        </ul>
        <p className="example">
          Example: the Mine holds a 5♦ and a 3♦. Your Vault is 8. You play a King (3) and a
          4♥ (4). You have 1 left.
        </p>
      </>
    ),
  },
  {
    id: "turn",
    title: "Your turn, step by step",
    body: (
      <ol>
        <li>
          <strong>Draw.</strong> Draw 1 card. (Nobody draws on their very first turn.)
        </li>
        <li>
          <strong>Play cards.</strong> In any order, you can:
          <ul>
            <li>take one Diamond action,</li>
            <li>summon Royals to your Court,</li>
            <li>play Hearts, Spades, Clubs and Jokers.</li>
          </ul>
        </li>
        <li>
          <strong>Attack (optional).</strong> Once per turn. After the fight you can still
          play cards.
        </li>
        <li>
          <strong>End turn.</strong> If you hold more than 7 cards, throw cards into the
          Abyss until you have 7. Then the next player starts.
        </li>
      </ol>
    ),
  },
  {
    id: "suits",
    title: "What each suit does",
    body: (
      <>
        <p>
          Number cards and Aces do something based on their suit. Most effects can target
          you, an opponent, or any Royal on the table.
        </p>
        <h3>♦ Diamonds &mdash; energy</h3>
        <p>
          Diamonds are free. You get <strong>one Diamond action per turn</strong>. Pick one:
        </p>
        <ul>
          <li>
            <strong>Mine:</strong> put the Diamond in the Mine. It adds energy for every
            player, every turn, for the rest of the game.
          </li>
          <li>
            <strong>Draw:</strong> throw the Diamond away and draw 1 card.
          </li>
          <li>
            <strong>Boost:</strong> throw the Diamond away and add its value to your Vault,
            or to another player&rsquo;s Vault. The boost lasts until that player&rsquo;s
            next turn starts.
          </li>
        </ul>
        <h3>♥ Hearts &mdash; healing</h3>
        <ul>
          <li>
            <strong>Heal a player:</strong> add the Heart&rsquo;s value to a player&rsquo;s
            life.
          </li>
          <li>
            <strong>Shield a Royal:</strong> attach it to a Royal for +value health.
          </li>
        </ul>
        <h3>♠ Spades &mdash; power</h3>
        <ul>
          <li>
            <strong>Power up a Royal:</strong> attach it to a Royal for +value attack and
            +value health.
          </li>
          <li>
            <strong>Bring back a card:</strong> throw the Spade away and take one card from
            the Abyss into your hand. That card&rsquo;s value must be the same as or lower
            than the Spade. A Joker counts as 10.
          </li>
        </ul>
        <h3>♣ Clubs &mdash; damage</h3>
        <ul>
          <li>
            <strong>Hit a player:</strong> deal the Club&rsquo;s value as damage to a
            player&rsquo;s life.
          </li>
          <li>
            <strong>Weaken a Royal:</strong> attach it to a Royal for &minus;value attack
            and &minus;value health. If its health drops to 0, the Royal goes to the Abyss.
            Its owner loses no life.
          </li>
        </ul>
        <h3>Spades and Clubs cancel out</h3>
        <p>
          If a Royal has Spades and Clubs attached with the same total value, they cancel.
          Those cards go to the Abyss and their effects end.
        </p>
        <p className="example">Example: a 5♠ and a 5♣ on the same Royal cancel each other.</p>
      </>
    ),
  },
  {
    id: "royals",
    title: "Royals",
    body: (
      <>
        <p>
          Jacks, Queens and Kings of any suit are <strong>Royals</strong>. They are your
          fighters. Summon them into your <strong>Court</strong> (your side of the table).
        </p>
        <table>
          <thead>
            <tr>
              <th>Royal</th>
              <th>Cost</th>
              <th>Attack</th>
              <th>Health</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Jack</td>
              <td>1</td>
              <td>1</td>
              <td>1</td>
            </tr>
            <tr>
              <td>Queen</td>
              <td>2</td>
              <td>2</td>
              <td>2</td>
            </tr>
            <tr>
              <td>King</td>
              <td>3</td>
              <td>3</td>
              <td>3</td>
            </tr>
          </tbody>
        </table>
        <ul>
          <li>You can only summon Royals on your own turn.</li>
          <li>
            A new Royal <strong>cannot attack on the turn you summon it</strong>. It can block
            right away.
          </li>
          <li>A Royal cannot be put on top of another Royal.</li>
          <li>
            Damage on Royals heals at the end of every turn. Attached Hearts, Spades and Clubs
            stay.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "combat",
    title: "Attacking, blocking and duels",
    body: (
      <>
        <h3>Attack</h3>
        <ul>
          <li>You can attack once per turn.</li>
          <li>
            Choose which of your Royals attack, and which opponent each one attacks. You can
            split them between opponents.
          </li>
          <li>
            A Royal that attacked cannot block until your next turn.
          </li>
        </ul>
        <h3>Block</h3>
        <ul>
          <li>
            Each opponent you attack chooses blockers from their own Court, or lets the
            attack through.
          </li>
          <li>Several Royals can block one attacker. Each Royal can block only one attacker.</li>
          <li>
            While blocking, the defender can play cards and take one Diamond action (Draw or
            Boost).
          </li>
        </ul>
        <h3>Unblocked attackers</h3>
        <p>An unblocked Royal hits the player at once for its attack value.</p>
        <h3>Duels</h3>
        <p>A blocked attacker starts a duel.</p>
        <ol>
          <li>
            If two or more Royals block one attacker, the attacker chooses the order they take
            damage.
          </li>
          <li>
            The defender acts first. Each side can play cards (not Royals), then taps{" "}
            <strong>Pass</strong>. The defender also gets one Diamond action (Draw or Boost).
            The attacker gets one only if they did not use their Diamond action this turn.
          </li>
          <li>When both sides have passed, the Royals fight.</li>
        </ol>
        <ul>
          <li>The attacker takes damage equal to the total attack of all its blockers.</li>
          <li>
            The attacker&rsquo;s damage goes to the first blocker. Damage left over after
            that blocker dies goes to the next one.
          </li>
          <li>
            A Royal whose health reaches 0 goes to the Abyss with its attached cards. If both
            reach 0, both go.
          </li>
          <li>A blocked attacker does not damage the player.</li>
          <li>
            If a player in the duel plays a Club on a Royal in that fight, the Club decides
            that fight. Those two Royals do not trade damage.
          </li>
        </ul>
        <p className="example">
          Example: your King (3/3) attacks. A Queen (2/2) blocks. The Queen takes 3 and goes to
          the Abyss. Your King takes 2, survives, and heals at the end of the turn.
        </p>
      </>
    ),
  },
  {
    id: "jokers",
    title: "Jokers",
    body: (
      <>
        <p>
          A Joker costs <strong>10</strong> energy. Pick one:
        </p>
        <ul>
          <li>
            <strong>Destroy</strong> any Royal. It goes to the Abyss with its attached cards.
          </li>
          <li>
            <strong>Deal 10 damage</strong> to any player.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "abyss",
    title: "The Abyss",
    body: (
      <ul>
        <li>
          The Abyss is the discard pile. Used cards, thrown-away cards and destroyed Royals
          (with their attached cards) go there.
        </li>
        <li>A Spade can bring a card back from the Abyss.</li>
        <li>When the deck runs out, the Abyss is shuffled into a new deck.</li>
      </ul>
    ),
  },
  {
    id: "other-turns",
    title: "Playing on other players' turns",
    body: (
      <>
        <p>
          On another player&rsquo;s turn, you can still play Hearts, Spades, Clubs and Jokers
          if your Vault can pay. They work at once. You cannot summon Royals, attack, or put
          Diamonds in the Mine on another player&rsquo;s turn.
        </p>
        <h3>Answering a Club</h3>
        <p>
          When a Club targets your Royal, you get a chance to answer before it lands. The same
          happens when a Club or Joker would take your life to 0. You can play cards (not
          Royals) and take one Diamond action (Draw or Boost). Then tap{" "}
          <strong>Accept</strong>.
        </p>
        <p className="example">
          Example: you have 4 life and an opponent plays a 6♣ at you. Before you accept, you
          play a 7♥. You go to 11 life, then take 6. You stay in the game with 5.
        </p>
      </>
    ),
  },
  {
    id: "elimination",
    title: "Elimination and winning",
    body: (
      <ul>
        <li>
          When your life reaches 0, you are out <strong>at once</strong>. You cannot be healed
          back.
        </li>
        <li>All Royals in your Court go to the Abyss with their attached cards.</li>
        <li>The game ends the moment only one mage is left. That mage wins.</li>
      </ul>
    ),
  },
  {
    id: "modes",
    title: "Play vs AI and multiplayer",
    body: (
      <ul>
        <li>
          <strong>Play vs AI:</strong> in the lobby, tap <strong>Play vs AI</strong> and pick
          an opponent: Emberlord (attacks hard), Frostweaver (defends and destroys your
          board), Gildspinner (plays the long game) or Fatecaller (a random mage each match).
        </li>
        <li>
          <strong>Play with friends:</strong> tap <strong>Create</strong> to open a match and
          share its invite code. Friends tap <strong>Join</strong> and enter the code. Up to 4
          players. The host starts the match.
        </li>
      </ul>
    ),
  },
];

export default function Rules() {
  return (
    <div className="relative min-h-screen flex flex-col items-center">
      <div className="noise-bg" />

      <main className="relative z-10 w-full max-w-3xl px-6 py-16 md:py-24">
        <Link href="/" className="font-serif text-sm tracking-[0.2em] uppercase text-primary/70 hover:text-primary">
          &larr; Mage Card Game
        </Link>

        <h1 className="font-serif text-4xl md:text-5xl tracking-wider text-gradient-gold uppercase mt-8 mb-6">
          How to play
        </h1>

        <nav aria-label="Sections" className="mb-12 flex flex-wrap gap-x-4 gap-y-2 font-serif text-sm text-foreground/60">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="hover:text-primary underline-offset-4 hover:underline">
              {s.title}
            </a>
          ))}
        </nav>

        <div className="space-y-12">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-8">
              <h2 className="font-serif text-2xl text-primary mb-3">{s.title}</h2>
              <div className="font-sans text-lg leading-relaxed text-foreground/85 space-y-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_li>ul]:mt-2 [&_a]:text-secondary [&_a]:underline [&_strong]:text-foreground [&_strong]:font-semibold [&_h3]:font-serif [&_h3]:text-xl [&_h3]:text-foreground [&_h3]:pt-3 [&_table]:w-full [&_table]:text-base [&_table]:border-collapse [&_th]:text-left [&_th]:font-serif [&_th]:text-primary/90 [&_th]:font-normal [&_th]:border-b [&_th]:border-primary/30 [&_th]:py-2 [&_th]:pr-3 [&_td]:border-b [&_td]:border-white/5 [&_td]:py-2 [&_td]:pr-3 [&_.example]:border-l-2 [&_.example]:border-secondary/60 [&_.example]:pl-4 [&_.example]:text-base [&_.example]:text-foreground/70 [&_.example]:italic">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-16 font-sans text-base text-foreground/60">
          Questions? See <Link href="/support">Support</Link>.
        </p>
      </main>

      <footer className="w-full py-8 text-center text-foreground/40 font-serif text-sm border-t border-white/5 z-10 mt-auto">
        <p>Mage Card Game &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
