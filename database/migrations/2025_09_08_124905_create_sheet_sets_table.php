<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sheet_sets', function (Blueprint $table) {
            $table->id();
            $table->string('name')->default('Untitled Set');
            $table->enum('status', ['open','closed'])->default('open');
            $table->boolean('is_current')->default(true); // app-enforced single true
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });

        // create an initial default set and mark it current
        DB::table('sheet_sets')->insert([
            'name'       => 'Default Set',
            'status'     => 'open',
            'is_current' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sheet_sets');
    }
};
