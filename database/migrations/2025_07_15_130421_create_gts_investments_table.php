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
        Schema::create('gts_investments', function (Blueprint $table) {
            $table->id();
            $table->date('date')->nullable();
            $table->string('investor')->nullable();
            $table->decimal('investment_amount', 15, 2)->default(0);
            $table->string('investment_no')->nullable();
            $table->string('mode_of_transaction')->nullable();
            $table->string('murabaha')->nullable();
            $table->string('repayment_terms')->nullable();
            $table->integer('loan_tenure')->nullable();
            $table->date('repayment_date')->nullable();
            $table->text('remarks')->nullable();
            $table->enum('status', ['draft', 'saved'])->default('draft');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gts_investments');
    }
};
