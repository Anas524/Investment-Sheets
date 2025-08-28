<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('customer_loan_ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('customer_sheet_id');
            $table->date('date');
            $table->string('description')->nullable();
            $table->decimal('amount', 12, 2); // positive = loan given, negative = repayment (your call)
            $table->timestamps();

            $table->foreign('customer_sheet_id')
                  ->references('id')->on('customer_sheets')
                  ->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_loan_ledger_entries');
    }
};
