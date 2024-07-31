$(document).ready(function() {
    let isSubmitting = false;
    let chatHistories = JSON.parse(localStorage.getItem('chatHistories')) || {};
    let currentChat = localStorage.getItem('currentChat') || null;

    $('#toggle-sidebar-btn').on('click', function() {
        $('#sidebar').toggleClass('hidden');
        $('#main-content').toggleClass('full-width');
    });

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function renderChatMessages(chatId) {
        $('#chat-messages').empty();
        if (chatHistories[chatId]) {
            chatHistories[chatId].messages.forEach(message => {
                $('#chat-messages').append(message);
            });
        }
        scrollToBottom();
    }

    function saveChatHistories() {
        localStorage.setItem('chatHistories', JSON.stringify(chatHistories));
    }

    function saveCurrentChat() {
        localStorage.setItem('currentChat', currentChat);
    }

    function setActiveChatButton(chatId) {
        $('.chat-button').removeClass('active');
        $(`.chat-button[data-chat-id="${chatId}"]`).addClass('active');
    }

    function createChatButton(chatName, chatId) {
        var chatButtonContainer = $('<div class="chat-button-container"></div>');
        var newButton = $('<button class="chat-button" data-chat-id="' + chatId + '">' + chatName + '<button class="edit-chat-button"><i class="fas fa-pencil-alt"></i></button><button class="delete-chat-button"><i class="fas fa-trash-alt"></i></button></button>');
    
        chatButtonContainer.append(newButton);
        $('#chat-history').append(chatButtonContainer);
    
        newButton.on('click', function(e) {
            if ($(e.target).hasClass('delete-chat-button') || $(e.target).closest('.delete-chat-button').length || $(e.target).hasClass('edit-chat-button') || $(e.target).closest('.edit-chat-button').length) {
                return;
            }
            currentChat = $(this).data('chat-id');
            renderChatMessages(currentChat);
            saveCurrentChat();
            setActiveChatButton(currentChat);
        });
    
        newButton.find('.delete-chat-button').on('click', function(e) {
            e.stopPropagation();
            var chatIdToDelete = $(this).closest('.chat-button').data('chat-id');
            delete chatHistories[chatIdToDelete];
            saveChatHistories();
            if (currentChat === chatIdToDelete) {
                currentChat = null;
                $('#chat-messages').empty();
                localStorage.removeItem('currentChat');
            }
            $(this).closest('.chat-button-container').remove();
        });
    
        newButton.find('.edit-chat-button').on('click', function(e) {
            e.stopPropagation();
            var chatIdToEdit = $(this).closest('.chat-button').data('chat-id');
            var newChatName = prompt("Enter the new name for the chat:", chatHistories[chatIdToEdit].name);
            if (newChatName) {
                chatHistories[chatIdToEdit].name = newChatName;
                $(this).closest('.chat-button').contents().first().replaceWith(newChatName);
                saveChatHistories();
            }
        });
    }

    $('#prompt-form').on('submit', function(e) {
        e.preventDefault();
        
        if (isSubmitting) return;
        isSubmitting = true;
        
        var formData = new FormData(this);
        
        // Ensure the model is always included in the form data
        if (!formData.has('model')) {
            formData.append('model', $('#model').val());
        }

        // If no chat is selected, create a new chat named "New Chat"
        if (!currentChat) {
            var chatId = generateUUID();
            currentChat = chatId;
            if (!chatHistories[currentChat]) {
                chatHistories[currentChat] = { name: "New Chat", messages: [] };
                createChatButton("New Chat", currentChat);
                setActiveChatButton(currentChat);
                saveCurrentChat();
            }
        }
        
        var userMessageHtml = '<div class="message user-message">' + formData.get('prompt') + '</div>';
        $('#chat-messages').append(userMessageHtml);
        scrollToBottom();
        
        // Save the message to the current chat history
        if (!chatHistories[currentChat]) {
            chatHistories[currentChat] = { name: "New Chat", messages: [] };
        }
        chatHistories[currentChat].messages.push(userMessageHtml);
        saveChatHistories();
        
        // Show spinner and hide button text
        $('.button-text').hide();
        $('.spinner').show();
        
        $.ajax({
            url: '/generate',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                var responseHtml = '<div class="message">';
                
                if (response.type === 'image') {
                    responseHtml += '<img src="' + response.content + '" alt="Generated Image">';
                } else {
                    var formattedContent = response.content.replace(/\n/g, '<br>');
                    formattedContent = formattedContent.replace(/(<br>){2,}/g, '</p><p>');
                    responseHtml += '<p>' + formattedContent + '</p>';
                }
                responseHtml += '</div>';
                $('#chat-messages').append(responseHtml);
                scrollToBottom();
                
                // Save the response to the current chat history
                chatHistories[currentChat].messages.push(responseHtml);
                saveChatHistories();
                
                $('#prompt').val('');
                $('#file').val('');
                $('.file-indicator').hide().text('');
                
                // Hide spinner and show button text
                $('.spinner').hide();
                $('.button-text').show();
                
                isSubmitting = false;
            },
            error: function(xhr, status, error) {
                alert('An error occurred while processing your request: ' + xhr.responseText);
                // Hide spinner and show button text
                $('.spinner').hide();
                $('.button-text').show();
                isSubmitting = false;
            }
        });
    });

    function toggleFileInput() {
        const modelSelect = document.getElementById('model');
        const fileUploadIcon = document.querySelector('.file-upload-icon');
        if (modelSelect.value === 'gpt4') {
            fileUploadIcon.style.display = 'inline-block';
        } else {
            fileUploadIcon.style.display = 'none';
        }
    }

    toggleFileInput();
    $('#model').on('change', toggleFileInput);

    // Display selected file name
    $('#file').on('change', function() {
        var fileName = $(this).val().split('\\').pop();
        if (fileName) {
            $('.file-indicator').text(fileName).show();
        } else {
            $('.file-indicator').hide().text('');
        }
    });

    $('.file-indicator').hide();

    $('#prompt').on('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if ($(this).val().trim() !== '') {
                $('#prompt-form').submit();
                $(this).val('');
            }
        }
    });

    function toggleSubmitButton() {
        const promptText = $('#prompt').val().trim();
        $('button[type="submit"]').prop('disabled', promptText === '');
    }

    $('#prompt').on('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        toggleSubmitButton();
    });

    toggleSubmitButton(); // Initial call to set button state

    $('#logout-btn').on('click', function(e) {
        e.preventDefault();
        window.location.href = '/logout';
    });

    // Set GPT-4 as default and show file upload icon
    $('#model').val('gpt4');
    toggleFileInput();

    $('#new-chat-btn').on('click', function() {
        var chatName = prompt("Enter the name for the new chat:");
        if (chatName) {
            var chatId = generateUUID();
            createChatButton(chatName, chatId);
            // Set the new chat as the current chat
            currentChat = chatId;
            chatHistories[chatId] = { name: chatName, messages: [] };
            renderChatMessages(chatId);
            saveCurrentChat();
            setActiveChatButton(currentChat);
        }
    });

    // Load chat history and current chat on page load
    Object.keys(chatHistories).forEach(chatId => {
        createChatButton(chatHistories[chatId].name, chatId);
    });
    
    if (currentChat) {
        renderChatMessages(currentChat);
        setActiveChatButton(currentChat);
    }
});

function scrollToBottom() {
    var chatMessages = document.getElementById('chat-messages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}