import asyncio
import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from orchestration.orchestrator import ExecutionOrchestrator
from execution.execution_queue import ExecutionQueue

async def test_stress():
    root = os.getcwd()
    eq = ExecutionQueue(root, concurrency=5)
    await eq.start()
    
    tasks = [("stress", [sys.executable, "-c", "import time; time.sleep(0.1)"], root, "s1") for _ in range(20)]
    for t in tasks:
        await eq.enqueue("task_id", *t)
        
    await eq.queue.join()
    await eq.shutdown()
    print("Stability Test: PASS")

if __name__ == "__main__":
    asyncio.run(test_stress())
