<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_conversations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 120)->nullable();
            $table->string('status', 16)->default('active');
            $table->string('model_key', 80)->nullable();
            $table->timestampTz('last_message_at')->nullable();
            $table->timestampsTz();
            $table->index(['user_id', 'last_message_at']);
        });

        Schema::create('ai_messages', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('conversation_id')->constrained('ai_conversations')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 16);
            $table->text('content'); // encrypted cast at model boundary
            $table->string('request_key', 100)->nullable();
            $table->char('request_hash', 64)->nullable();
            $table->uuid('reply_to_id')->nullable()->unique();
            $table->string('provider_message_id', 190)->nullable();
            $table->string('model_key', 80)->nullable();
            $table->unsignedInteger('usage_input')->nullable();
            $table->unsignedInteger('usage_output')->nullable();
            $table->string('status', 16);
            $table->string('error_code', 64)->nullable();
            $table->timestampsTz();
            $table->unique(['user_id', 'request_key']);
            $table->index(['conversation_id', 'created_at']);
        });

        Schema::create('ai_daily_usage', function (Blueprint $table): void {
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('usage_date');
            $table->unsignedInteger('reserved')->default(0);
            $table->primary(['user_id', 'usage_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_daily_usage');
        Schema::dropIfExists('ai_messages');
        Schema::dropIfExists('ai_conversations');
    }
};
