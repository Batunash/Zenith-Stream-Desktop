import React from 'react';
import { useTranslation } from 'react-i18next';

const TransferList = ({ transfers }) => {
  const { t } = useTranslation();

  if (Object.keys(transfers).length === 0) return null;

  return (
    <div style={styles.transferContainer}>
      {Object.entries(transfers).map(([path, item]) => {
        const fileName = path.split(/[/\\]/).pop();
        return (
          <div key={path} style={styles.transferItem}>
            <div style={styles.transferInfo}>
              <span style={styles.fileName} title={fileName}>
                {fileName}
              </span>
              <span style={styles.percentText}>
                {item.status === 'error'
                  ? t('transfer.status_error')
                  : item.status === 'completed'
                    ? t('transfer.status_completed')
                    : `%${item.percent.toFixed(0)}`}
              </span>
            </div>
            <div style={styles.progressBarBg}>
              <div
                style={{
                  ...styles.progressBarFill,
                  width: `${item.percent}%`,
                  backgroundColor:
                    item.status === 'error'
                      ? '#ef4444'
                      : item.status === 'completed'
                        ? '#22c55e'
                        : '#3b82f6',
                }}
              />
            </div>
            {item.error && <div style={styles.errorText}>{item.error}</div>}
          </div>
        );
      })}
    </div>
  );
};

const styles = {
  transferContainer: {
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  transferItem: {
    backgroundColor: '#222',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #333',
  },
  transferInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '5px',
    fontSize: '0.9rem',
  },
  fileName: { maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  percentText: { fontWeight: 'bold', color: '#aaa', fontSize: '0.8rem' },
  progressBarBg: {
    width: '100%',
    height: '6px',
    backgroundColor: '#444',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', transition: 'width 0.3s ease, background-color 0.3s' },
  errorText: { color: '#ef4444', fontSize: '0.75rem', marginTop: 2 },
};

export default TransferList;
