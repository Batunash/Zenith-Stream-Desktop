import React from 'react';

const FormInput = ({ label, value, onChange, placeholder, type = "text", required = false, isTextArea = false }) => {
  const styles = {
    wrapper: { marginBottom: '20px' },
    label: { display: 'block', color: '#ccc', marginBottom: '8px', fontSize: '0.9rem' },
    input: {
      width: '100%',
      padding: '12px',
      backgroundColor: '#222',
      border: '1px solid #444',
      borderRadius: '8px',
      color: 'white',
      fontSize: '1rem',
      outline: 'none',
      transition: 'border-color 0.2s',
      fontFamily: 'inherit'
    },
    required: { color: '#e50914', marginLeft: '4px' }
  };

  return (
    <div style={styles.wrapper}>
      <label style={styles.label}>
        {label}
        {required && <span style={styles.required}>*</span>}
      </label>
      
      {isTextArea ? (
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={4}
          style={{...styles.input, resize: 'vertical'}}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={styles.input}
        />
      )}
    </div>
  );
};

export default FormInput;