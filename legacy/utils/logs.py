import sys
import logging


class LogManager:
	def __init__(self, func_name):
		self.func_name = func_name
		log_file = f"logs/{func_name}_log.txt"

		logging.basicConfig(
			level=logging.DEBUG,
			format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
			datefmt="%Y-%m-%d %H:%M:%S",
			handlers=[
				logging.StreamHandler(sys.stdout),
				logging.FileHandler(log_file, mode="a")
			],
		)
	
	def get_logger(self):
		return logging.getLogger(self.func_name)


if __name__ == "__main__":
	log_manager = LogManager("game_logic").get_logger()
	log_manager.info("This is a test log entry for game_logic.")
