import React, { useState, useEffect } from 'react';
import { gas_tracking_dapp_icp_backend } from 'declarations/gas_tracking_dapp_icp_backend';

function App() {
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState({});

  useEffect(() => {
    checkConnection();
    fetchTransactions();
    fetchStatistics();
  }, []);

  const checkConnection = async () => {
    if (window.ic?.plug) {
      try {
        const connected = await window.ic.plug.isConnected();
        if (!connected) {
          const whitelist = [process.env.GAS_TRACKING_DAPP_ICP_BACKEND_CANISTER_ID];
          const host = "http://localhost:4943";
          await window.ic.plug.requestConnect({ whitelist, host });
        }
        setIsConnected(true);
        setError('');
      } catch (e) {
        setError('Failed to connect to wallet: ' + e.message);
        setIsConnected(false);
      }
    } else {
      setError('Plug wallet not found. Please install it from https://plugwallet.ooo/');
      setIsConnected(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const result = await gas_tracking_dapp_icp_backend.get_all_transactions();
      setTransactions(result);
    } catch (e) {
      console.error('Error fetching transactions:', e);
    }
  };

  const fetchStatistics = async () => {
    try {
      const result = await gas_tracking_dapp_icp_backend.get_gas_statistics();
      setStatistics(result);
    } catch (e) {
      console.error('Error fetching statistics:', e);
    }
  };

  const handleTransaction = async (type) => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError('');
    try {
      let result;
      switch (type) {
        case 'simple':
          result = await gas_tracking_dapp_icp_backend.record_simple_transaction();
          break;
        case 'complex':
          result = await gas_tracking_dapp_icp_backend.record_complex_transaction();
          break;
        case 'storage':
          result = await gas_tracking_dapp_icp_backend.record_storage_transaction();
          break;
      }
      console.log(`${type} transaction result:`, result);
      await fetchTransactions();
      await fetchStatistics();
    } catch (e) {
      setError(`Failed to record ${type} transaction: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  const calculateAverage = (type) => {
    if (!statistics[type] || statistics[type].length === 0) return { cycles: 0, memory: 0 };
    const sum = statistics[type].reduce((acc, curr) => ({
      cycles: acc.cycles + Number(curr.cycles_used),
      memory: acc.memory + Number(curr.memory_used)
    }), { cycles: 0, memory: 0 });
    return {
      cycles: sum.cycles / statistics[type].length,
      memory: sum.memory / statistics[type].length
    };
  };

  return (
    <div className="container">
      <h1>Gas Tracking DApp</h1>

      {error && <div className="error-message">{error}</div>}

      <div className={`wallet-status ${isConnected ? 'connected' : ''}`}>
        {isConnected ? (
          <p>✓ Wallet Connected</p>
        ) : (
          <button onClick={checkConnection} className="connect-button">
            Connect Plug Wallet
          </button>
        )}
      </div>

      <div className="transaction-buttons">
        <button
          onClick={() => handleTransaction('simple')}
          disabled={loading || !isConnected}
        >
          {loading ? 'Processing...' : 'Record Simple Transaction'}
        </button>
        <button
          onClick={() => handleTransaction('complex')}
          disabled={loading || !isConnected}
        >
          {loading ? 'Processing...' : 'Record Complex Transaction'}
        </button>
        <button
          onClick={() => handleTransaction('storage')}
          disabled={loading || !isConnected}
        >
          {loading ? 'Processing...' : 'Record Storage Transaction'}
        </button>
      </div>

      <section className="gas-comparison">
        <h2>Gas Usage Comparison</h2>
        <div className="comparison-table">
          <table>
            <thead>
              <tr>
                <th>Transaction Type</th>
                <th>Average Cycles Used</th>
                <th>Average Memory Used</th>
                <th>Total Transactions</th>
              </tr>
            </thead>
            <tbody>
              {['simple', 'complex', 'storage'].map(type => {
                const avg = calculateAverage(type);
                return (
                  <tr key={type}>
                    <td>{type.charAt(0).toUpperCase() + type.slice(1)}</td>
                    <td>{formatNumber(Math.round(avg.cycles))} cycles</td>
                    <td>{formatNumber(Math.round(avg.memory))} bytes</td>
                    <td>{statistics[type]?.length || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="recent-transactions">
        <h2>Recent Transactions</h2>
        {transactions.length === 0 ? (
          <p className="no-transactions">No transactions recorded yet</p>
        ) : (
          <div className="transactions-grid">
            {transactions.slice().reverse().map((tx, index) => (
              <div key={index} className="transaction-card">
                <h3>{tx.transaction_type.charAt(0).toUpperCase() + tx.transaction_type.slice(1)} Transaction</h3>
                <p>Cycles Used: {formatNumber(Number(tx.gas_info.cycles_used))}</p>
                <p>Memory Used: {formatNumber(Number(tx.gas_info.memory_used))} bytes</p>
                <p>Timestamp: {new Date(Number(tx.gas_info.timestamp) / 1_000_000).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
