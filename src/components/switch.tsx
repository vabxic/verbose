
import styled from 'styled-components';

interface SwitchProps {
  isChecked: boolean;
  onChange: (checked: boolean) => void;
}

const Switch = ({ isChecked, onChange }: SwitchProps) => {
  return (
    <StyledWrapper>
      <label className="switch">
        <input 
          id="input" 
          type="checkbox" 
          checked={isChecked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="slider round">
          <div className="sun-moon">
            <svg className="sun-icon" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5" fill="currentColor" />
              <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" />
              <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" />
              <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" />
            </svg>
            <svg className="moon-icon" viewBox="0 0 24 24">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" />
            </svg>
          </div>
        </div>
      </label>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .switch {
    position: relative;
    display: inline-block;
    width: 60px;
    height: 34px;
  }

  .switch #input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.2);
    -webkit-transition: 0.4s;
    transition: 0.4s;
    z-index: 0;
    overflow: hidden;
  }

  .sun-moon {
    position: absolute;
    height: 26px;
    width: 26px;
    left: 4px;
    bottom: 4px;
    background-color: #ffd700;
    -webkit-transition: 0.4s;
    transition: 0.4s;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  #input:checked + .slider {
    background-color: #4f46e5;
  }

  #input:checked + .slider .sun-moon {
    -webkit-transform: translateX(26px);
    -ms-transform: translateX(26px);
    transform: translateX(26px);
    background-color: #6366f1;
  }

  .sun-icon,
  .moon-icon {
    width: 16px;
    height: 16px;
    position: absolute;
  }

  .sun-icon {
    opacity: 0;
    transition: opacity 0.4s;
    color: #ffd700;
  }

  .moon-icon {
    opacity: 1;
    transition: opacity 0.4s;
    color: white;
  }

  /* when checked (light theme) show sun, hide moon */
  #input:checked + .slider .sun-moon .sun-icon {
    opacity: 1;
  }

  #input:checked + .slider .sun-moon .moon-icon {
    opacity: 0;
  }

  .slider.round {
    border-radius: 34px;
  }

  .slider.round .sun-moon {
    border-radius: 50%;
  }
`;

export default Switch;
