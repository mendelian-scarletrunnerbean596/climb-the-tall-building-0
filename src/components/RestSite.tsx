import { useGameStore } from '../game/store';
import { Card } from './Card';
import { Heart, TrendingUp } from 'lucide-react';
import { useState } from 'react';

export function RestSite() {
  const rest = useGameStore(s => s.rest);
  const player = useGameStore(s => s.player);
  const deck = useGameStore(s => s.deck);
  const upgradeCard = useGameStore(s => s.upgradeCard);

  const [showUpgrade, setShowUpgrade] = useState(false);

  const healAmount = Math.floor(player.maxHp * 0.3);
  const upgradableCards = deck.filter(c => !c.upgraded);

  if (showUpgrade) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center fade-in"
        style={{ background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #08080f 70%)' }}>
        
        <div className="text-center mb-8">
          <h2 className="font-cinzel text-2xl font-bold text-green-400 mb-2">Upgrade a Card</h2>
          <p className="text-white/50 text-sm">Choose a card to upgrade</p>
        </div>

        <div className="flex flex-wrap gap-4 justify-center max-w-4xl mb-8 overflow-y-visible px-4 py-8 mt-[-2rem] relative z-10">
          {upgradableCards.map(card => (
            <Card
              key={card.uid}
              card={card}
              onClick={() => upgradeCard(card.uid)}
              small
              showUpgradeGlow
            />
          ))}
        </div>

        <button onClick={() => setShowUpgrade(false)} className="btn-secondary">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center fade-in"
      style={{ background: 'radial-gradient(ellipse at 50% 60%, #1a2e1a 0%, #08080f 70%)' }}>
      
      {/* Campfire */}
      <div className="text-6xl mb-6 animate-pulse">🔥</div>

      <h2 className="font-cinzel text-3xl font-bold text-amber-400 mb-2">Rest Site</h2>
      <p className="text-white/40 text-sm mb-10">Take a well-deserved break</p>

      <div className="flex gap-6">
        {/* Rest option */}
        <button
          onClick={rest}
          className="flex flex-col items-center gap-3 p-6 rounded-xl transition-all duration-300 hover:scale-105 cursor-pointer"
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          <Heart size={32} className="text-green-400" />
          <span className="font-bold text-green-400">Rest</span>
          <span className="text-xs text-white/50">Heal {healAmount} HP</span>
          <span className="text-[10px] text-white/30">({player.hp}/{player.maxHp} HP)</span>
        </button>

        {/* Upgrade option */}
        <button
          onClick={() => upgradableCards.length > 0 ? setShowUpgrade(true) : null}
          disabled={upgradableCards.length === 0}
          className="flex flex-col items-center gap-3 p-6 rounded-xl transition-all duration-300 hover:scale-105 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}
        >
          <TrendingUp size={32} className="text-amber-400" />
          <span className="font-bold text-amber-400">Smith</span>
          <span className="text-xs text-white/50">Upgrade a Card</span>
          <span className="text-[10px] text-white/30">({upgradableCards.length} upgradable)</span>
        </button>
      </div>
    </div>
  );
}

export function EventScreen() {
  const setPhase = useGameStore(s => s.setPhase);
  const currentEventId = useGameStore(s => s.currentEventId);
  const applyEventOutcome = useGameStore(s => s.applyEventOutcome);
  const player = useGameStore(s => s.player);

  const [resolved, setResolved] = useState(false);
  const [outcomeText, setOutcomeText] = useState('');

  const handleChoice = (
    text: string, 
    outcome: { hp?: number; maxHp?: number; gold?: number; upgradeRandom?: boolean }
  ) => {
    applyEventOutcome(outcome);
    setOutcomeText(text);
    setResolved(true);
  };

  const renderEvent = () => {
    switch (currentEventId) {
      case 'shrine':
        return (
          <>
            <div className="text-6xl mb-6">🏛️</div>
            <h2 className="font-cinzel text-2xl font-bold text-blue-400 mb-3">Forgotten Shrine</h2>
            <p className="text-white/70 text-sm mb-8 text-center max-w-md">
              You come across an ancient shrine. The energy here is palpable. You feel compelled to make an offering or pray.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => handleChoice('You prayed and feel reinvigorated.', { maxHp: 5 })} className="btn-primary w-64">
                Pray <span className="text-xs opacity-70">(+5 Max HP)</span>
              </button>
              <button disabled={player.gold < 50} onClick={() => handleChoice('You offered gold. A card was miraculously upgraded!', { gold: -50, upgradeRandom: true })} className="btn-secondary w-64 disabled:opacity-30">
                Offer Gold <span className="text-xs opacity-70">(Lose 50 Gold, Upgrade a random card)</span>
              </button>
              <button onClick={() => handleChoice('You left the shrine undisturbed.', {})} className="btn-secondary w-64">
                Leave
              </button>
            </div>
          </>
        );
      case 'cleric':
        return (
          <>
            <div className="text-6xl mb-6">⛪</div>
            <h2 className="font-cinzel text-2xl font-bold text-amber-400 mb-3">The Cleric</h2>
            <p className="text-white/70 text-sm mb-8 text-center max-w-md">
              A friendly Cleric offers their services, for a price.
            </p>
            <div className="flex flex-col gap-3">
              <button disabled={player.gold < 35} onClick={() => handleChoice('The Cleric chants a healing spell.', { gold: -35, hp: 20 })} className="btn-primary w-64 disabled:opacity-30">
                Heal <span className="text-xs opacity-70">(Lose 35 Gold, Heal 20 HP)</span>
              </button>
              <button onClick={() => handleChoice('You politely declined and walked away.', {})} className="btn-secondary w-64">
                Leave
              </button>
            </div>
          </>
        );
      case 'thieves':
        return (
          <>
            <div className="text-6xl mb-6">🎭</div>
            <h2 className="font-cinzel text-2xl font-bold text-red-400 mb-3">Masked Bandits</h2>
            <p className="text-white/70 text-sm mb-8 text-center max-w-md">
              "Hand over your gold and nobody gets hurt!" The bandits surround you.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => handleChoice('You handed over your gold to avoid a fight.', { gold: -Math.floor(player.gold * 0.5) })} className="btn-secondary w-64">
                Pay up <span className="text-xs opacity-70">(Lose 50% of your Gold)</span>
              </button>
              <button onClick={() => handleChoice('You fought back and took a beating, but kept your gold!', { hp: -15 })} className="btn-primary w-64 bg-red-600/20 text-red-400 border-red-500/50">
                Fight! <span className="text-xs opacity-70">(Take 15 Damage)</span>
              </button>
            </div>
          </>
        );
      case 'golden_idol':
        return (
          <>
            <div className="text-6xl mb-6">🗿</div>
            <h2 className="font-cinzel text-2xl font-bold text-yellow-400 mb-3">Golden Idol</h2>
            <p className="text-white/70 text-sm mb-8 text-center max-w-md">
              You find a massive Golden Idol resting on a pressure plate. Taking it will surely trigger a trap.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => handleChoice('A boulder smashed you as you grabbed the idol!', { gold: 100, hp: -25 })} className="btn-primary w-64">
                Take it <span className="text-xs opacity-70">(Gain 100 Gold, Take 25 Damage)</span>
              </button>
              <button onClick={() => handleChoice('You wisely decided to leave it alone.', {})} className="btn-secondary w-64">
                Leave
              </button>
            </div>
          </>
        );
      case 'upgrade_shrine':
      default:
        return (
          <>
            <div className="text-6xl mb-6">✨</div>
            <h2 className="font-cinzel text-2xl font-bold text-purple-400 mb-3">Glowing Anvil</h2>
            <p className="text-white/70 text-sm mb-8 text-center max-w-md">
              A magical anvil hums with energy. However, it seems touching it burns your skin.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => handleChoice('You endured the pain to upgrade a card!', { hp: -10, upgradeRandom: true })} className="btn-primary w-64">
                Use Anvil <span className="text-xs opacity-70">(Take 10 Damage, Upgrade random card)</span>
              </button>
              <button onClick={() => handleChoice('You left the anvil alone.', {})} className="btn-secondary w-64">
                Ignore
              </button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center fade-in"
      style={{ background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #08080f 70%)' }}>
      
      {!resolved ? (
        renderEvent()
      ) : (
        <>
          <div className="text-6xl mb-6">📖</div>
          <h2 className="font-cinzel text-2xl font-bold text-blue-400 mb-6">Event Resolved</h2>
          <p className="text-white/90 text-lg mb-10 text-center max-w-md">
            {outcomeText}
          </p>
          <button onClick={() => setPhase('map')} className="btn-primary w-48">
            Continue Map
          </button>
        </>
      )}
    </div>
  );
}
