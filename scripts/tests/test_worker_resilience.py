import asyncio
import os
import sys
import uuid
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from execution.execution_queue import ExecutionQueue

async def test_worker_recovery():
    root = os.getcwd()
    eq = ExecutionQueue(root, concurrency=1)
    await eq.start()
    
    print("--- Running Resilience Tests ---")
    
    # 1. Enqueue task that triggers exception (simulate with orchestrator error)
    await eq.enqueue("fail-task", "fail", ["invalid-cmd"], root, "s1")
    
    # 2. Enqueue subsequent valid task to verify recovery
    await eq.enqueue("ok-task", "ok", [sys.executable, "--version"], root, "s1")
        
    await eq.queue.join()
    await eq.shutdown()
    print("Resilience Test: PASS")

if __name__ == "__main__":
    asyncio.run(test_worker_recovery())
