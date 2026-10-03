<?php

/* No provider, commercial capability or quota is assumed to exist in production. */
return [
    'enabled' => filter_var(env('AI_ENABLED', false), FILTER_VALIDATE_BOOL),
    'external_processing_approved' => filter_var(env('AI_EXTERNAL_PROCESSING_APPROVED', false), FILTER_VALIDATE_BOOL),
    'capability' => env('AI_CAPABILITY', 'ai.mentor'),
    'model_key' => env('AI_MODEL_KEY'),
    'quota' => ['daily_requests' => (int) env('AI_DAILY_REQUESTS', 0)],
    'limits' => [
        'message_chars' => 4000,
        'context_chars' => 1200,
        'answer_chars' => (int) env('AI_MAX_ANSWER_CHARS', 8000),
        'history_messages' => 6,
        'attachments' => 3,
    ],
    'rate_limits' => [
        'user_per_minute' => (int) env('AI_RATE_USER_PER_MINUTE', 10),
        'ip_per_minute' => (int) env('AI_RATE_IP_PER_MINUTE', 30),
        'upload_per_minute' => (int) env('AI_RATE_UPLOAD_PER_MINUTE', 5),
    ],
];
