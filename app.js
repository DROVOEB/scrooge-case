const { useState, useEffect, useRef } = React;

// --- Хранилище баланса ---
const STORAGE_KEY = 'scrooge_balance';

function App() {
    const [balance, setBalance] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? parseInt(saved) : 1000; // стартовые 1000 Stars
    });
    const [activeGame, setActiveGame] = useState('mines');
    const [toast, setToast] = useState('');

    const showToast = (msg, isError = false) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2000);
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(isError ? 'heavy' : 'light');
        }
    };

    const addStars = (amount) => {
        const newBalance = balance + amount;
        setBalance(newBalance);
        localStorage.setItem(STORAGE_KEY, newBalance);
        showToast(`+${amount} Stars`, false);
    };

    const deductStars = (amount) => {
        if (balance >= amount) {
            const newBalance = balance - amount;
            setBalance(newBalance);
            localStorage.setItem(STORAGE_KEY, newBalance);
            return true;
        }
        showToast('Недостаточно Stars! Пополните баланс.', true);
        return false;
    };

    const addWin = (amount) => {
        const newBalance = balance + amount;
        setBalance(newBalance);
        localStorage.setItem(STORAGE_KEY, newBalance);
        showToast(`Вы выиграли ${amount} Stars!`, false);
    };

    useEffect(() => {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
        }
    }, []);

    return (
        <div className="app">
            <div className="top-bar">
                <div className="balance">
                    <span className="stars">⭐ {balance} Stars</span>
                </div>
                <button className="add-stars" onClick={() => addStars(500)}>➕ 500 Stars</button>
            </div>

            <div className="game-nav">
                <div className={`game-tab ${activeGame === 'mines' ? 'active' : ''}`} onClick={() => setActiveGame('mines')}>💣 Минное поле</div>
                <div className={`game-tab ${activeGame === 'wheel' ? 'active' : ''}`} onClick={() => setActiveGame('wheel')}>🎡 Колесо фортуны</div>
                <div className={`game-tab ${activeGame === 'rocket' ? 'active' : ''}`} onClick={() => setActiveGame('rocket')}>🚀 Ракетка</div>
            </div>

            {activeGame === 'mines' && <MinesGame balance={balance} deductStars={deductStars} addWin={addWin} showToast={showToast} />}
            {activeGame === 'wheel' && <WheelGame balance={balance} deductStars={deductStars} addWin={addWin} showToast={showToast} />}
            {activeGame === 'rocket' && <RocketGame balance={balance} deductStars={deductStars} addWin={addWin} showToast={showToast} />}
            
            <div id="toast" className="toast" style={{ opacity: toast ? 1 : 0 }}>{toast}</div>
        </div>
    );
}

// ---- Игра 1: Минное поле 5x5 ----
function MinesGame({ balance, deductStars, addWin, showToast }) {
    const [bet, setBet] = useState(20);
    const [minesCount, setMinesCount] = useState(3);
    const [gameActive, setGameActive] = useState(false);
    const [board, setBoard] = useState([]);
    const [revealed, setRevealed] = useState([]);
    const [multiplier, setMultiplier] = useState(1);
    const [safeLeft, setSafeLeft] = useState(0);
    const [currentBetAmount, setCurrentBetAmount] = useState(0);

    const initGame = () => {
        if (!deductStars(bet)) return;
        setCurrentBetAmount(bet);
        const size = 5;
        const totalMines = minesCount;
        let newBoard = Array(size).fill().map(() => Array(size).fill(0));
        let minesPlaced = 0;
        while (minesPlaced < totalMines) {
            const r = Math.floor(Math.random() * size);
            const c = Math.floor(Math.random() * size);
            if (newBoard[r][c] !== -1) {
                newBoard[r][c] = -1;
                minesPlaced++;
            }
        }
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (newBoard[i][j] !== -1) {
                    let cnt = 0;
                    for (let di = -1; di <= 1; di++) {
                        for (let dj = -1; dj <= 1; dj++) {
                            if (di === 0 && dj === 0) continue;
                            const ni = i+di, nj = j+dj;
                            if (ni>=0 && ni<size && nj>=0 && nj<size && newBoard[ni][nj]===-1) cnt++;
                        }
                    }
                    newBoard[i][j] = cnt;
                }
            }
        }
        setBoard(newBoard);
        setRevealed(Array(size).fill().map(() => Array(size).fill(false)));
        setGameActive(true);
        setMultiplier(1);
        setSafeLeft(size*size - totalMines);
        showToast(`Игра началась! Ставка ${bet} Stars, мин: ${totalMines}`);
    };

    const revealCell = (row, col) => {
        if (!gameActive) return;
        if (revealed[row][col]) return;
        if (board[row][col] === -1) {
            // мина
            setGameActive(false);
            showToast(`💥 Взорвались! Проиграно ${currentBetAmount} Stars`, true);
            return;
        }
        const newRevealed = [...revealed];
        newRevealed[row][col] = true;
        setRevealed(newRevealed);
        const newSafeLeft = safeLeft - 1;
        setSafeLeft(newSafeLeft);
        const totalSafe = 25 - minesCount;
        const opened = totalSafe - newSafeLeft;
        const newMultiplier = 1 + (opened / totalSafe) * 4;
        setMultiplier(newMultiplier);
        if (newSafeLeft === 0) {
            const win = Math.floor(currentBetAmount * newMultiplier);
            addWin(win);
            setGameActive(false);
            showToast(`🏆 ПОБЕДА! Выигрыш ${win} Stars!`);
        }
    };

    const cashout = () => {
        if (!gameActive) return;
        const win = Math.floor(currentBetAmount * multiplier);
        addWin(win);
        setGameActive(false);
        showToast(`💰 Вы забрали ${win} Stars!`);
    };

    const renderBoard = () => {
        if (!board.length) return <div>Начните игру</div>;
        return (
            <div className="mines-grid">
                {board.map((row, i) => row.map((cell, j) => (
                    <div key={`${i}-${j}`} className={`mine-cell ${revealed[i][j] ? 'revealed' : ''} ${revealed[i][j] && cell === -1 ? 'mine' : ''}`} onClick={() => revealCell(i, j)}>
                        {revealed[i][j] ? (cell === -1 ? '💣' : cell === 0 ? '✨' : cell) : '?'}
                    </div>
                )))}
            </div>
        );
    };

    return (
        <div className="game-card">
            <h3>💣 Минное поле 5x5</h3>
            <div>Баланс: ⭐ {balance}</div>
            <div>
                <label>Ставка: </label>
                <input type="number" min="20" value={bet} onChange={(e) => setBet(Math.max(20, parseInt(e.target.value) || 20))} disabled={gameActive} />
                <label> Мин: </label>
                <select value={minesCount} onChange={(e) => setMinesCount(parseInt(e.target.value))} disabled={gameActive}>
                    <option value="3">3 мины</option>
                    <option value="5">5 мин</option>
                    <option value="7">7 мин</option>
                </select>
            </div>
            <button className="btn" onClick={initGame} disabled={gameActive}>🚀 Новая игра</button>
            {gameActive && <button className="btn btn-cash" onClick={cashout}>💰 Забрать (x{multiplier.toFixed(2)})</button>}
            {renderBoard()}
            {gameActive && <div>Множитель: x{multiplier.toFixed(2)} | Потенциальный выигрыш: {Math.floor(currentBetAmount * multiplier)} Stars</div>}
        </div>
    );
}

// ---- Игра 2: Колесо фортуны (ставки, шансы, таймер) ----
function WheelGame({ balance, deductStars, addWin, showToast }) {
    const [participants, setParticipants] = useState([]);
    const [myBet, setMyBet] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [roundActive, setRoundActive] = useState(false);
    const [spinning, setSpinning] = useState(false);
    const intervalRef = useRef(null);

    const joinRound = () => {
        if (roundActive) { showToast("Раунд уже идёт! Повысьте ставку или ждите.", true); return; }
        if (myBet < 10) { showToast("Минимальная ставка 10 Stars", true); return; }
        if (!deductStars(myBet)) return;
        setParticipants([{ id: 'me', name: 'Вы', bet: myBet, chance: 100 }]);
        setRoundActive(true);
        setTimeLeft(20);
        startTimer();
        showToast(`Вы вошли в раунд со ставкой ${myBet} Stars!`);
    };

    const raiseBet = () => {
        if (!roundActive) { showToast("Нет активного раунда", true); return; }
        const extra = 10;
        if (!deductStars(extra)) return;
        setParticipants(prev => prev.map(p => p.id === 'me' ? { ...p, bet: p.bet + extra } : p));
        showToast(`Ставка повышена на +10 Stars`);
    };

    const startTimer = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current);
                    spinWheel();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const spinWheel = () => {
        if (!roundActive) return;
        setSpinning(true);
        setTimeout(() => {
            const totalBet = participants.reduce((sum, p) => sum + p.bet, 0);
            const winnerIndex = Math.floor(Math.random() * participants.length);
            const winner = participants[winnerIndex];
            addWin(totalBet);
            showToast(`🎡 Колесо остановилось! Победитель: ${winner.name} (забрал ${totalBet} Stars)`);
            setParticipants([]);
            setRoundActive(false);
            setSpinning(false);
        }, 3000);
    };

    useEffect(() => {
        return () => clearInterval(intervalRef.current);
    }, []);

    const myParticipant = participants.find(p => p.id === 'me');
    const totalBet = participants.reduce((sum, p) => sum + p.bet, 0);
    const myChance = totalBet > 0 && myParticipant ? (myParticipant.bet / totalBet * 100).toFixed(1) : 0;

    return (
        <div className="game-card">
            <h3>🎡 Колесо фортуны</h3>
            <div>Баланс: ⭐ {balance}</div>
            <div>Ставка: <input type="number" min="10" value={myBet} onChange={(e) => setMyBet(Math.max(10, parseInt(e.target.value) || 10))} disabled={roundActive} /> Stars</div>
            <button className="btn" onClick={joinRound} disabled={roundActive}>🎲 Вступить в раунд</button>
            <button className="btn" onClick={raiseBet} disabled={!roundActive}>⬆️ Повысить ставку (+10)</button>
            {roundActive && <div>⏱️ До розыгрыша: {timeLeft} сек | Ваш шанс: {myChance}% (банк {totalBet} Stars)</div>}
            <div className="wheel-container">
                <div className={`wheel ${spinning ? 'spinning' : ''}`}></div>
            </div>
            <div className="participants-list">
                {participants.map((p, idx) => (
                    <div key={idx} className="participant"><span>{p.name}</span><span>⭐ {p.bet}</span></div>
                ))}
            </div>
        </div>
    );
}

// ---- Игра 3: Ракетка (коэффициенты, взрыв) ----
function RocketGame({ balance, deductStars, addWin, showToast }) {
    const [bet, setBet] = useState(50);
    const [gameActive, setGameActive] = useState(false);
    const [multiplier, setMultiplier] = useState(1);
    const [flying, setFlying] = useState(false);
    const [targetMultiplier, setTargetMultiplier] = useState(0);
    const [myBetAmount, setMyBetAmount] = useState(0);
    const [cashedOut, setCashedOut] = useState(false);
    const intervalRef = useRef(null);

    const startRound = () => {
        if (bet < 50) { showToast("Минимальная ставка 50 Stars", true); return; }
        if (!deductStars(bet)) return;
        setMyBetAmount(bet);
        setGameActive(true);
        setCashedOut(false);
        setMultiplier(1);
        setFlying(true);
        const target = +(Math.random() * (66 - 1.01) + 1.01).toFixed(2);
        setTargetMultiplier(target);
        let current = 1;
        intervalRef.current = setInterval(() => {
            current += 0.05;
            setMultiplier(+current.toFixed(2));
            if (current >= target) {
                clearInterval(intervalRef.current);
                setFlying(false);
                setGameActive(false);
                showToast(`💥 Ракета взорвалась на x${target}! Вы не успели забрать.`, true);
            }
        }, 100);
        showToast(`Ракета летит! Цель x${target}`);
    };

    const cashoutRocket = () => {
        if (!gameActive || cashedOut) return;
        clearInterval(intervalRef.current);
        const win = Math.floor(myBetAmount * multiplier);
        addWin(win);
        setCashedOut(true);
        setGameActive(false);
        setFlying(false);
        showToast(`💰 Вы забрали ${win} Stars (x${multiplier.toFixed(2)})`);
    };

    useEffect(() => {
        return () => clearInterval(intervalRef.current);
    }, []);

    return (
        <div className="game-card">
            <h3>🚀 Ракетка</h3>
            <div>Баланс: ⭐ {balance}</div>
            <div>Ставка: <input type="number" min="50" value={bet} onChange={(e) => setBet(Math.max(50, parseInt(e.target.value) || 50))} disabled={gameActive} /> Stars</div>
            <button className="btn" onClick={startRound} disabled={gameActive}>🚀 Запустить ракету</button>
            <button className="btn btn-cash" onClick={cashoutRocket} disabled={!gameActive || cashedOut}>💰 Забрать (x{multiplier.toFixed(2)})</button>
            <div className="rocket-area">
                <div className={`rocket ${flying ? 'flying' : ''}`}>🚀</div>
                <div>Текущий коэффициент: <strong>x{multiplier.toFixed(2)}</strong></div>
                {gameActive && <div>Потенциальный выигрыш: {Math.floor(myBetAmount * multiplier)} Stars</div>}
            </div>
            <div className="coefficient-list">
                {[1.08, 1.01, 1.09, 1.04, 2.82, 1.30, 1.75, 1.45, 1.06, 1.94, 3.96, 1.01, 1.50, 11.20, 1.01, 2.09, 1.27, 2.92, 66.25, 1.14, 1.01].map((c, i) => (
                    <div key={i} className="coeff-item">x{c}</div>
                ))}
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);