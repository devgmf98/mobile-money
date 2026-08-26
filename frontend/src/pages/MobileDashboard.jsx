import React from 'react';
import styles from './MobileDashboard.module.css';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bell, Bitcoin, Briefcase, ChartColumn, CircleUserRound, Gem, House, Plus, RefreshCw, Search } from 'lucide-react';

export default function MobileDashboard() {
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <CircleUserRound className={styles.avatar} />
        <div className={styles.headerIcons}>
          <Search className={styles.icon} />
          <Bell className={styles.icon} />
        </div>
      </div>

      {/* Balance Card */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceInfo}>
          <span className={styles.balanceLabel}>My Balance</span>
          <span className={styles.balanceAmount}>634.22 <span className={styles.currency}>USD</span></span>
        </div>
        <button className={styles.depositBtn}><Plus /> Deposit</button>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.actionBtn}><ArrowDown /><span>Buy</span></button>
        <button className={styles.actionBtn}><ArrowUp /><span>Sell</span></button>
        <button className={styles.actionBtn}><ArrowRight /><span>Send</span></button>
        <button className={styles.actionBtn}><ArrowLeft /><span>Receive</span></button>
      </div>

      {/* Top Movers */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Top mover's</span>
          <a href="#" className={styles.seeAll}>See all</a>
        </div>
        <div className={styles.movers}>
          <div className={styles.moverCard}>
            <div className={styles.moverIcon} style={{background:'#000'}}>PTCT</div>
            <div className={styles.moverInfo}>
              <span className={styles.moverPrice}>$25.87 USD</span>
              <span className={styles.moverChangeUp}>▲ 3.73%</span>
            </div>
          </div>
          <div className={styles.moverCard}>
            <div className={styles.moverIcon} style={{background:'#F59E0B'}}>ENPH</div>
            <div className={styles.moverInfo}>
              <span className={styles.moverPrice}>106.77 USD</span>
              <span className={styles.moverChangeDown}>▼ 2.94%</span>
            </div>
          </div>
          <div className={styles.moverCard}>
            <div className={styles.moverIcon} style={{background:'#00A86B'}}>FORD</div>
            <div className={styles.moverInfo}>
              <span className={styles.moverPrice}>10.69 USD</span>
              <span className={styles.moverChangeUp}>▲ 0.85%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Watchlist */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Watchlist</span>
          <a href="#" className={styles.seeAll}>See all</a>
        </div>
        <div className={styles.watchlist}>
          <div className={styles.watchCard}>
            <Bitcoin className={styles.cryptoIcon} style={{color:'#f7931a'}} />
            <div className={styles.watchInfo}>
              <span className={styles.cryptoName}>Bitcoin <span className={styles.cryptoSymbol}>BTC</span></span>
              <span className={styles.cryptoPrice}>$43,884.25 USD</span>
            </div>
            <span className={styles.cryptoChangeUp}>▲ 0.4%</span>
          </div>
          <div className={styles.watchCard}>
            <Gem className={styles.cryptoIcon} style={{color:'#627eea'}} />
            <div className={styles.watchInfo}>
              <span className={styles.cryptoName}>Ethereum <span className={styles.cryptoSymbol}>ETH</span></span>
              <span className={styles.cryptoPrice}>$2,265.14 USD</span>
            </div>
            <span className={styles.cryptoChangeDown}>▼ 0.3%</span>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className={styles.bottomNav}>
        <button className={styles.navBtn + ' ' + styles.active}><span role="img" aria-label="Home"><House size={18} /></span><span>Home</span></button>
        <button className={styles.navBtn}><span role="img" aria-label="Trade"><RefreshCw size={18} /></span><span>Trade</span></button>
        <button className={styles.navBtn}><span role="img" aria-label="More"><ChartColumn size={18} /></span><span>Markets</span></button>
        <button className={styles.navBtn}><span role="img" aria-label="Assets"><Briefcase size={18} /></span><span>Assets</span></button>
      </nav>
    </div>
  );
}
