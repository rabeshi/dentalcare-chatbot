// app.ts - Main application logic for DentalCare website

// Navigation functionality
function initNavigation(): void {
  const navLinks = document.querySelectorAll('.nav-menu a');
  const ctaButtons = document.querySelectorAll('.cta-button');

  // Smooth scrolling for nav links
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href')?.substring(1);
      const targetElement = document.getElementById(targetId || '');
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // CTA button handlers
  ctaButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (button.textContent?.includes('Book Appointment') || button.classList.contains('nav-cta')) {
        const contactSection = document.getElementById('contact');
        contactSection?.scrollIntoView({ behavior: 'smooth' });
      } else if (button.id === 'chat-trigger') {
        toggleChat();
      }
    });
  });
}

// Form handling
function initForms(): void {
  const appointmentForm = document.getElementById('appointment-form') as HTMLFormElement;

  appointmentForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    // In a real application, this would send data to a server
    alert('Thank you for your appointment request! We will contact you soon.');
    appointmentForm.reset();
  });
}

// Chatbot functionality
let chatPanel: HTMLDivElement | null = null;

function initChatbot(): void {
  const chatToggle = document.getElementById('chat-toggle') as HTMLButtonElement;
  const chatClose = document.getElementById('chat-close') as HTMLButtonElement;
  const chatSend = document.getElementById('chat-send') as HTMLButtonElement;
  const chatInput = document.getElementById('chat-input-field') as HTMLInputElement;
  const chatMessages = document.getElementById('chat-messages') as HTMLDivElement;
  chatPanel = document.getElementById('chat-panel') as HTMLDivElement;
  const suggestionButtons = document.querySelectorAll('.suggestion-btn');

  chatToggle?.addEventListener('click', toggleChat);
  chatClose?.addEventListener('click', toggleChat);

  chatSend?.addEventListener('click', () => sendMessage(chatInput, chatMessages));
  chatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage(chatInput, chatMessages);
    }
  });

  suggestionButtons.forEach(button => {
    button.addEventListener('click', () => {
      const question = button.textContent || '';
      chatInput.value = question;
      sendMessage(chatInput, chatMessages);
    });
  });
}

function toggleChat(): void {
  chatPanel?.classList.toggle('open');
}

function createToothIcon(className: string): HTMLSpanElement {
  const iconSpan = document.createElement('span');
  iconSpan.className = className;
  iconSpan.setAttribute('aria-hidden', 'true');

  const toothSpan = document.createElement('span');
  toothSpan.className = 'tooth-icon tooth-icon-message';
  iconSpan.appendChild(toothSpan);

  return iconSpan;
}

async function sendMessage(chatInput: HTMLInputElement, chatMessages: HTMLDivElement): Promise<void> {
  const message = chatInput.value.trim();
  if (!message) return;

  // Add user message
  addMessage(message, 'user', chatMessages);
  chatInput.value = '';

  // Show typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message bot';
  const typingContent = document.createElement('div');
  typingContent.className = 'message-content';
  typingContent.appendChild(createToothIcon('message-icon'));

  const typingText = document.createElement('p');
  typingText.textContent = 'Dental AI is typing...';
  typingContent.appendChild(typingText);

  typingDiv.appendChild(typingContent);
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    // Send to RAG API
    const response = await fetch('/api/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: message }),
    });

    const data = await response.json();

    // Remove typing indicator
    chatMessages.removeChild(typingDiv);

    if (response.ok) {
      addMessage(data.answer, 'bot', chatMessages);
    } else {
      addMessage('Sorry, I encountered an error. Please try again or contact us directly.', 'bot', chatMessages);
    }
  } catch (error) {
    // Remove typing indicator
    chatMessages.removeChild(typingDiv);
    addMessage('Sorry, I\'m having trouble connecting. Please try again later.', 'bot', chatMessages);
  }
}

function addMessage(text: string, sender: 'user' | 'bot', chatMessages: HTMLDivElement): void {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  if (sender === 'bot') {
    contentDiv.appendChild(createToothIcon('message-icon'));
  }

  const textP = document.createElement('p');
  textP.textContent = text;
  contentDiv.appendChild(textP);

  messageDiv.appendChild(contentDiv);
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Animation on scroll
function initScrollAnimations(): void {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  }, observerOptions);

  // Observe all sections
  const sections = document.querySelectorAll('section');
  sections.forEach(section => {
    observer.observe(section);
  });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initForms();
  initChatbot();
  initScrollAnimations();
});
