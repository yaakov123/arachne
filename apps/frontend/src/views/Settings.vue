<template>
  <div class="settings-container">
    <div class="settings-header">
      <h1>Settings</h1>
      <p>Manage proxy server and certificate authority settings</p>
    </div>

    <div class="settings-content">
      <!-- Proxy Management Section -->
      <div class="settings-section">
        <div class="section-header">
          <h2>Proxy Server</h2>
          <p>Control the MITM proxy server</p>
        </div>
        
        <div class="section-content">
          <div class="control-group">
            <div class="control-info">
              <h3>Proxy Status</h3>
              <p>Start or stop the proxy server to intercept HTTP/HTTPS traffic</p>
              <div class="status-indicator">
                <span class="status-dot" :class="{ 'running': proxyRunning, 'stopped': !proxyRunning }"></span>
                <span class="status-text">{{ proxyRunning ? 'Running' : 'Stopped' }}</span>
              </div>
            </div>
            <div class="control-actions">
              <button 
                class="btn btn-primary" 
                :disabled="proxyLoading || proxyRunning"
                @click="startProxy"
              >
                <span v-if="proxyLoading" class="loading-spinner"></span>
                Start Proxy
              </button>
              <button 
                class="btn btn-secondary" 
                :disabled="proxyLoading || !proxyRunning"
                @click="stopProxy"
              >
                <span v-if="proxyLoading" class="loading-spinner"></span>
                Stop Proxy
              </button>
            </div>
          </div>
          
          <div v-if="proxyMessage" class="message" :class="proxyMessageType">
            {{ proxyMessage }}
          </div>
        </div>
      </div>

      <!-- Certificate Authority Section -->
      <div class="settings-section">
        <div class="section-header">
          <h2>Certificate Authority</h2>
          <p>Manage Root CA certificate for HTTPS interception</p>
        </div>
        
        <div class="section-content">
          <div class="control-group">
            <div class="control-info">
              <h3>Root CA Certificate</h3>
              <p>Create and manage the Root Certificate Authority for SSL/TLS interception</p>
            </div>
            <div class="control-actions">
              <button 
                class="btn btn-primary" 
                :disabled="caLoading"
                @click="createCA"
              >
                <span v-if="caLoading" class="loading-spinner"></span>
                Create/Ensure CA
              </button>
            </div>
          </div>
          
          <!-- Trust Instructions -->
          <div v-if="trustInstructions" class="control-group">
            <div class="control-info">
              <h3>System Trust Instructions</h3>
              <p>Run these commands in your terminal to trust/untrust the Root CA</p>
            </div>
            <div class="trust-instructions">
              <div class="instruction-section">
                <h4>To Trust the CA:</h4>
                <div class="command-block">
                  <code>{{ trustInstructions.trustCommand }}</code>
                  <button 
                    class="btn btn-sm btn-outline" 
                    @click="copyToClipboard(trustInstructions.trustCommand)"
                  >
                    Copy
                  </button>
                </div>
              </div>
              
              <div v-if="trustInstructions.untrustCommands.length > 0" class="instruction-section">
                <h4>To Untrust the CA:</h4>
                <div v-for="(command, index) in trustInstructions.untrustCommands" :key="index" class="command-block">
                  <code>{{ command }}</code>
                  <button 
                    class="btn btn-sm btn-outline" 
                    @click="copyToClipboard(command)"
                  >
                    Copy
                  </button>
                </div>
              </div>
              
              <div class="instruction-note">
                <p><strong>Certificate Path:</strong> {{ trustInstructions.certPath }}</p>
              </div>
            </div>
          </div>
          
          <div v-if="caMessage" class="message" :class="caMessageType">
            {{ caMessage }}
          </div>

          <!-- Certificate Display -->
          <div v-if="caCertPem" class="control-group">
            <div class="control-info">
              <h3>Certificate PEM</h3>
              <p>Current Root CA certificate in PEM format</p>
            </div>
            <div class="cert-display">
              <textarea 
                readonly 
                :value="caCertPem" 
                class="cert-textarea"
                rows="10"
              ></textarea>
              <button class="btn btn-outline" @click="copyCertToClipboard">
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/services/http'

// Proxy state
const proxyLoading = ref(false)
const proxyMessage = ref('')
const proxyMessageType = ref<'success' | 'error' | 'info'>('info')
const proxyRunning = ref(false)

// CA state
const caLoading = ref(false)
const trustLoading = ref(false)
const caMessage = ref('')
const caMessageType = ref<'success' | 'error' | 'info'>('info')
const caCertPem = ref('')
const trustInstructions = ref<{
  trustCommand: string
  untrustCommands: string[]
  certPath: string
} | null>(null)

// Proxy methods
async function checkProxyStatus() {
  try {
    const response = await api.getProxyStatus()
    proxyRunning.value = response.isRunning
  } catch (error) {
    // Silently fail - assume proxy is not running
    proxyRunning.value = false
  }
}

async function startProxy() {
  proxyLoading.value = true
  proxyMessage.value = ''
  
  try {
    const response = await api.startProxy()
    if (response.ok) {
      proxyMessage.value = response.message
      proxyMessageType.value = 'success'
      await checkProxyStatus() // Update status after starting
    } else {
      proxyMessage.value = response.message || 'Failed to start proxy'
      proxyMessageType.value = 'error'
    }
  } catch (error) {
    proxyMessage.value = error instanceof Error ? error.message : 'Unknown error occurred'
    proxyMessageType.value = 'error'
  } finally {
    proxyLoading.value = false
  }
}

async function stopProxy() {
  proxyLoading.value = true
  proxyMessage.value = ''
  
  try {
    const response = await api.stopProxy()
    if (response.ok) {
      proxyMessage.value = response.message
      proxyMessageType.value = 'success'
      await checkProxyStatus() // Update status after stopping
    } else {
      proxyMessage.value = response.message || 'Failed to stop proxy'
      proxyMessageType.value = 'error'
    }
  } catch (error) {
    proxyMessage.value = error instanceof Error ? error.message : 'Unknown error occurred'
    proxyMessageType.value = 'error'
  } finally {
    proxyLoading.value = false
  }
}

// CA methods
async function createCA() {
  caLoading.value = true
  caMessage.value = ''
  
  try {
    const response = await api.createCA()
    if (response.ok) {
      caMessage.value = response.message
      caMessageType.value = 'success'
      if (response.certPem) {
        caCertPem.value = response.certPem
      }
      // Load trust instructions after CA is created
      await loadTrustInstructions()
    } else {
      caMessage.value = response.message || 'Failed to create CA'
      caMessageType.value = 'error'
    }
  } catch (error) {
    caMessage.value = error instanceof Error ? error.message : 'Unknown error occurred'
    caMessageType.value = 'error'
  } finally {
    caLoading.value = false
  }
}

async function loadTrustInstructions() {
  try {
    const response = await api.getTrustInstructions()
    if (response.ok) {
      trustInstructions.value = {
        trustCommand: response.trustCommand,
        untrustCommands: response.untrustCommands,
        certPath: response.certPath
      }
    }
  } catch (error) {
    console.warn('Failed to load trust instructions:', error)
  }
}

async function copyCertToClipboard() {
  try {
    await navigator.clipboard.writeText(caCertPem.value)
    caMessage.value = 'Certificate copied to clipboard'
    caMessageType.value = 'success'
  } catch (error) {
    caMessage.value = 'Failed to copy to clipboard'
    caMessageType.value = 'error'
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    caMessage.value = 'Command copied to clipboard'
    caMessageType.value = 'success'
  } catch (error) {
    caMessage.value = 'Failed to copy command to clipboard'
    caMessageType.value = 'error'
  }
}

// Load existing certificate on mount
async function loadExistingCert() {
  try {
    const response = await api.getCert()
    caCertPem.value = response.pem
  } catch (error) {
    // Silently fail - cert might not exist yet
  }
}

// Load cert and proxy status on component mount
onMounted(async () => {
  await loadExistingCert()
  await checkProxyStatus()
  await loadTrustInstructions()
})
</script>

<style scoped>
.settings-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.settings-header {
  margin-bottom: 3rem;
}

.settings-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-color, #1f2937);
  margin: 0 0 0.5rem 0;
}

.settings-header p {
  font-size: 1.125rem;
  color: var(--text-color-secondary, #6b7280);
  margin: 0;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.settings-section {
  background: var(--surface-card, #ffffff);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  border: 1px solid var(--surface-border, #e5e7eb);
}

.section-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--surface-border, #e5e7eb);
}

.section-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-color, #1f2937);
  margin: 0 0 0.5rem 0;
}

.section-header p {
  color: var(--text-color-secondary, #6b7280);
  margin: 0;
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.control-group {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
  padding: 1.5rem;
  background: var(--surface-ground, #f9fafb);
  border-radius: 8px;
  border: 1px solid var(--surface-border, #e5e7eb);
}

.control-info {
  flex: 1;
}

.control-info h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color, #1f2937);
  margin: 0 0 0.5rem 0;
}

.control-info p {
  color: var(--text-color-secondary, #6b7280);
  margin: 0;
  line-height: 1.5;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.status-dot.running {
  background-color: #10b981;
}

.status-dot.stopped {
  background-color: #6b7280;
}

.status-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color-secondary, #6b7280);
}

.control-actions {
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.875rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 120px;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--primary-color, #3b82f6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-color-dark, #2563eb);
}

.btn-secondary {
  background-color: var(--surface-200, #e5e7eb);
  color: var(--text-color, #1f2937);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--surface-300, #d1d5db);
}

.btn-success {
  background-color: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #059669;
}

.btn-warning {
  background-color: #f59e0b;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background-color: #d97706;
}

.btn-outline {
  background-color: transparent;
  color: var(--primary-color, #3b82f6);
  border-color: var(--primary-color, #3b82f6);
}

.btn-outline:hover:not(:disabled) {
  background-color: var(--primary-color, #3b82f6);
  color: white;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.message {
  padding: 1rem;
  border-radius: 6px;
  font-weight: 500;
}

.message.success {
  background-color: #d1fae5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.message.error {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.message.info {
  background-color: #dbeafe;
  color: #1e40af;
  border: 1px solid #93c5fd;
}

.cert-display {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cert-textarea {
  width: 100%;
  padding: 1rem;
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.75rem;
  line-height: 1.4;
  background-color: var(--surface-ground, #f9fafb);
  color: var(--text-color, #1f2937);
  resize: vertical;
}

.cert-textarea:focus {
  outline: none;
  border-color: var(--primary-color, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Trust Instructions Styles */
.trust-instructions {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.instruction-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.instruction-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color, #1f2937);
  margin: 0;
}

.command-block {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--surface-ground, #f9fafb);
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: 8px;
}

.command-block code {
  flex: 1;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  color: var(--text-color, #1f2937);
  background: none;
  padding: 0;
  word-break: break-all;
}

.instruction-note {
  padding: 0.75rem;
  background: var(--blue-50, #eff6ff);
  border: 1px solid var(--blue-200, #bfdbfe);
  border-radius: 8px;
}

.instruction-note p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--blue-700, #1d4ed8);
}

@media (max-width: 768px) {
  .settings-container {
    padding: 1rem;
  }
  
  .control-group {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .control-actions {
    justify-content: stretch;
  }
  
  .btn {
    flex: 1;
  }
}
</style>
