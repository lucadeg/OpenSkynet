// Button Clickability Verification Script
// Run this in the browser console to verify button infrastructure

console.log('=== BUTTON CLICKABILITY VERIFICATION ===');

// Wait for panel to open
const verifyButtons = () => {
  console.log('1. Checking if SandboxPanel exists...');
  const panel = document.querySelector('[aria-label="Browser panel"]');
  console.log('   Panel found:', !!panel);

  if (!panel) {
    console.error('   ERROR: SandboxPanel not found. Open the browser panel first.');
    return false;
  }

  console.log('2. Checking for TEST button...');
  const testButton = Array.from(document.querySelectorAll('button')).find(btn =>
    btn.textContent?.includes('TEST: Click to verify buttons work')
  );
  console.log('   TEST button found:', !!testButton);
  console.log('   TEST button visible:', testButton ? getComputedStyle(testButton).display !== 'none' : 'N/A');
  console.log('   TEST button has pointer-events:', testButton ? getComputedStyle(testButton).pointerEvents : 'N/A');

  console.log('3. Checking for Start Browser button...');
  const startButton = Array.from(document.querySelectorAll('button')).find(btn =>
    btn.textContent?.includes('Start Browser')
  );
  console.log('   Start Browser button found:', !!startButton);

  console.log('4. Checking for Create Sandbox button...');
  const createButton = Array.from(document.querySelectorAll('button')).find(btn =>
    btn.textContent?.includes('Create Browser Sandbox')
  );
  console.log('   Create Sandbox button found:', !!createButton);

  console.log('5. Checking for Upload Files button...');
  const uploadButton = Array.from(document.querySelectorAll('button')).find(btn =>
    btn.textContent?.includes('Upload Files')
  );
  console.log('   Upload Files button found:', !!uploadButton);

  console.log('6. Checking if buttons have onclick handlers...');
  const buttons = [testButton, startButton, createButton, uploadButton].filter(Boolean);
  buttons.forEach(btn => {
    const hasOnClick = btn.onclick !== null;
    console.log(`   Button "${btn.textContent?.trim?.substring(0, 30)}" has onclick:`, hasOnClick);
  });

  console.log('7. Checking for overlays that might block clicks...');
  const computedPanel = getComputedStyle(panel);
  console.log('   Panel z-index:', computedPanel.zIndex);
  console.log('   Panel pointer-events:', computedPanel.pointerEvents);
  console.log('   Panel position:', computedPanel.position);
  console.log('   Panel display:', computedPanel.display);

  console.log('8. Checking resize handle...');
  const resizeHandle = document.querySelector('.cursor-col-resize');
  console.log('   Resize handle found:', !!resizeHandle);
  if (resizeHandle) {
    const handleStyle = getComputedStyle(resizeHandle);
    console.log('   Handle z-index:', handleStyle.zIndex);
    console.log('   Handle pointer-events:', handleStyle.pointerEvents);
  }

  console.log('=== VERIFICATION COMPLETE ===');
  console.log('TO TEST CLICKS: Manually click the TEST button and check for green bar + console log');
  return true;
};

// Auto-run verification
setTimeout(() => {
  console.log('Running automatic button verification...');
  verifyButtons();
}, 2000);

// Also expose globally for manual running
window.verifyButtons = verifyButtons;
console.log('Verification script loaded. Run verifyButtons() in console to check.');
